import logging
from collections import defaultdict
from datetime import timedelta

from django.db.models import Count, Sum
from django.utils import timezone

from apps.intelligence.models import PlatformSettings
from apps.line_bot.models import LineUserBinding, StoreLineBotConfig, StoreUserPushLog
from apps.line_bot.services.line_api import LineMessagingAPI
from apps.loyalty.models import CustomerLoyaltyAccount
from apps.orders.models import DineInOrderItem, TakeoutOrderItem
from apps.products.models import Product

logger = logging.getLogger(__name__)


class StoreRecommendationPushService:
    """店家對用戶的熱門推薦與新品推薦自動推播服務。"""

    def __init__(self):
        self.platform_settings = PlatformSettings.get_settings()
        self.now = timezone.now()

    def _get_effective_frequency(self, config):
        platform_interval = max(1, int(self.platform_settings.personalized_recommendation_min_interval_minutes or 4320))
        platform_weekly_limit = int(self.platform_settings.personalized_recommendation_weekly_limit or 2)

        if config.use_platform_recommendation_frequency:
            return platform_interval, platform_weekly_limit

        interval = config.popular_recommendation_min_interval_minutes
        weekly_limit = config.popular_recommendation_weekly_limit

        interval = platform_interval if interval is None else max(1, int(interval))
        weekly_limit = platform_weekly_limit if weekly_limit is None else max(0, int(weekly_limit))
        return interval, weekly_limit

    def _get_store_bindings(self, store):
        accounts = CustomerLoyaltyAccount.objects.filter(store=store).select_related('user')
        user_ids = [account.user_id for account in accounts]
        bindings = {
            b.user_id: b
            for b in LineUserBinding.objects.filter(
                user_id__in=user_ids,
                is_active=True,
                current_mode='customer',
            ).select_related('user')
        }
        return [bindings[account.user_id] for account in accounts if account.user_id in bindings]

    def _log(self, *, store, binding, push_type, status, reason='', error_message='', product_ids=None):
        StoreUserPushLog.objects.create(
            store=store,
            user=binding.user if binding and binding.user_id else None,
            line_user_id=binding.line_user_id if binding else '',
            push_type=push_type,
            status=status,
            reason=reason,
            error_message=error_message,
            product_ids=product_ids or [],
        )

    def _is_popular_eligible(self, *, store, binding, interval_minutes, weekly_limit, force=False):
        if force:
            return True, ''

        if weekly_limit == 0:
            return False, 'weekly_limit_zero'

        last_success = StoreUserPushLog.objects.filter(
            store=store,
            user=binding.user,
            push_type='store_popular',
            status='success',
        ).order_by('-created_at').first()
        if last_success and self.now - last_success.created_at < timedelta(minutes=interval_minutes):
            return False, 'min_interval_not_reached'

        window_start = self.now - timedelta(days=7)
        weekly_count = StoreUserPushLog.objects.filter(
            store=store,
            user=binding.user,
            push_type='store_popular',
            status='success',
            created_at__gte=window_start,
        ).count()
        if weekly_count >= weekly_limit:
            return False, 'weekly_limit_reached'

        return True, ''

    def _get_store_popular_products(self, store, limit=3):
        product_scores = defaultdict(int)

        for row in (
            TakeoutOrderItem.objects.filter(order__store=store)
            .exclude(order__status='rejected')
            .filter(product_id__isnull=False)
            .values('product_id')
            .annotate(total_qty=Sum('quantity'))
        ):
            product_scores[row['product_id']] += int(row['total_qty'] or 0)

        for row in (
            DineInOrderItem.objects.filter(order__store=store)
            .exclude(order__status='rejected')
            .filter(product_id__isnull=False)
            .values('product_id')
            .annotate(total_qty=Sum('quantity'))
        ):
            product_scores[row['product_id']] += int(row['total_qty'] or 0)

        if not product_scores:
            return []

        ranked_ids = [pid for pid, _ in sorted(product_scores.items(), key=lambda item: item[1], reverse=True)]
        products = Product.objects.filter(id__in=ranked_ids, store=store, is_available=True).select_related('category')
        by_id = {p.id: p for p in products}
        return [by_id[pid] for pid in ranked_ids if pid in by_id][:limit]

    def _build_store_popular_message(self, store, products):
        if not products:
            return None

        lines = [
            f"🔥 {store.name} 熱門推薦",
            '',
            '根據近期熱銷趨勢，這幾樣很受歡迎：',
        ]
        for product in products:
            lines.append(f"• {product.name}")
        return '\n'.join(lines)

    def _get_user_preference_profile(self, user, store, limit=4):
        tag_score = defaultdict(int)
        category_score = defaultdict(int)
        category_names = {}

        takeout_items = TakeoutOrderItem.objects.filter(
            order__user=user,
            order__store=store,
            product_id__isnull=False,
        ).select_related('product__category')

        dinein_items = DineInOrderItem.objects.filter(
            order__user=user,
            order__store=store,
            product_id__isnull=False,
        ).select_related('product__category')

        for item in list(takeout_items) + list(dinein_items):
            qty = int(item.quantity or 1)
            product = item.product
            if not product:
                continue

            if product.food_tags:
                for tag in product.food_tags:
                    tag_score[tag] += qty

            if product.category_id:
                category_score[product.category_id] += qty
                category_names[product.category_id] = product.category.name if product.category else '未分類'

        top_tags = [tag for tag, _ in sorted(tag_score.items(), key=lambda item: item[1], reverse=True)[:limit]]
        top_category_ids = [cid for cid, _ in sorted(category_score.items(), key=lambda item: item[1], reverse=True)[:limit]]
        top_category_names = [category_names.get(cid, '未分類') for cid in top_category_ids]

        return top_tags, set(top_category_ids), top_category_names

    def _get_last_new_product_success_log(self, store, binding):
        return StoreUserPushLog.objects.filter(
            store=store,
            user=binding.user,
            push_type='store_new_product',
            status='success',
        ).order_by('-created_at').first()

    def _get_matching_new_products(self, store, top_tags, top_category_ids, since_dt, limit=3):
        if not top_tags and not top_category_ids:
            return []

        candidates = Product.objects.filter(
            store=store,
            is_available=True,
            created_at__gte=since_dt,
        ).select_related('category').order_by('-created_at')[:80]

        matched = []
        for product in candidates:
            product_tags = product.food_tags or []
            tag_match = any(
                (fav in ptag) or (ptag in fav)
                for fav in top_tags
                for ptag in product_tags
            )
            category_match = product.category_id in top_category_ids if product.category_id else False

            if tag_match or category_match:
                matched.append(product)

        return matched[:limit]

    def _build_new_product_message(self, store, products, labels):
        if not products:
            return None

        label_text = '、'.join(labels[:4]) if labels else '你的口味偏好'
        lines = [
            f"🆕 {store.name} 個人化新品推薦",
            '',
            f"我們發現你最近對「{label_text}」很有興趣，這些新品可能正中你胃口：",
        ]
        for product in products:
            category_name = product.category.name if product.category else '未分類'
            lines.append(f"• {product.name}（{category_name}）")
        return '\n'.join(lines)

    def run_auto_cycle(self, *, force=False):
        summary = {
            'stores_count': 0,
            'recipient_count': 0,
            'success_count': 0,
            'failure_count': 0,
            'skipped_count': 0,
            'popular_success_count': 0,
            'new_product_success_count': 0,
        }

        if not self.platform_settings.is_line_bot_enabled:
            summary['detail'] = 'platform_line_bot_disabled'
            return summary

        configs = StoreLineBotConfig.objects.filter(is_active=True).select_related('store')
        summary['stores_count'] = configs.count()

        for config in configs:
            if not config.has_line_config():
                continue

            interval_minutes, weekly_limit = self._get_effective_frequency(config)
            line_api = LineMessagingAPI(config)
            bindings = self._get_store_bindings(config.store)
            summary['recipient_count'] += len(bindings)

            popular_products = self._get_store_popular_products(config.store, limit=3)
            popular_text = self._build_store_popular_message(config.store, popular_products)

            for binding in bindings:
                # 使用者在個人資料關閉個人化推薦後，不接收店家通知。
                if not binding.notify_personalized_recommendation:
                    summary['skipped_count'] += 1
                    self._log(
                        store=config.store,
                        binding=binding,
                        push_type='store_popular',
                        status='skipped',
                        reason='user_personalized_disabled',
                    )
                    continue

                messages = []
                sent_types = []
                sent_new_product_ids = []

                if config.enable_popular_recommendation_push and popular_text:
                    eligible, reason = self._is_popular_eligible(
                        store=config.store,
                        binding=binding,
                        interval_minutes=interval_minutes,
                        weekly_limit=weekly_limit,
                        force=force,
                    )
                    if eligible:
                        messages.append(line_api.create_text_message(popular_text))
                        sent_types.append('store_popular')
                    else:
                        summary['skipped_count'] += 1
                        self._log(
                            store=config.store,
                            binding=binding,
                            push_type='store_popular',
                            status='skipped',
                            reason=reason,
                        )

                if config.enable_new_product_recommendation_push:
                    top_tags, top_category_ids, top_category_names = self._get_user_preference_profile(binding.user, config.store)
                    last_new_product_log = self._get_last_new_product_success_log(config.store, binding)
                    if last_new_product_log:
                        since_dt = last_new_product_log.created_at
                    else:
                        since_dt = self.now - timedelta(hours=24)

                    new_products = self._get_matching_new_products(
                        config.store,
                        top_tags,
                        top_category_ids,
                        since_dt,
                        limit=3,
                    )
                    label_basis = top_tags[:2] + top_category_names[:2]
                    new_product_text = self._build_new_product_message(config.store, new_products, label_basis)
                    if new_product_text:
                        messages.append(line_api.create_text_message(new_product_text))
                        sent_types.append('store_new_product')
                        sent_new_product_ids = [product.id for product in new_products]
                    else:
                        summary['skipped_count'] += 1
                        self._log(
                            store=config.store,
                            binding=binding,
                            push_type='store_new_product',
                            status='skipped',
                            reason='no_similar_new_products',
                        )

                if not messages:
                    continue

                try:
                    result = line_api.push_message(binding.line_user_id, messages[:5])
                    if result:
                        summary['success_count'] += 1
                        for push_type in sent_types:
                            product_ids = []
                            if push_type == 'store_new_product':
                                product_ids = sent_new_product_ids
                            self._log(
                                store=config.store,
                                binding=binding,
                                push_type=push_type,
                                status='success',
                                reason='auto_cycle',
                                product_ids=product_ids,
                            )
                            if push_type == 'store_popular':
                                summary['popular_success_count'] += 1
                            if push_type == 'store_new_product':
                                summary['new_product_success_count'] += 1
                    else:
                        summary['failure_count'] += 1
                        for push_type in sent_types:
                            self._log(
                                store=config.store,
                                binding=binding,
                                push_type=push_type,
                                status='failed',
                                reason='line_push_failed',
                            )
                except Exception as exc:
                    summary['failure_count'] += 1
                    for push_type in sent_types:
                        self._log(
                            store=config.store,
                            binding=binding,
                            push_type=push_type,
                            status='failed',
                            reason='line_push_exception',
                            error_message=str(exc),
                        )
                    logger.warning('Store auto recommendation push failed for %s: %s', binding.line_user_id, exc)

        return summary
