import logging
from datetime import timedelta
from collections import defaultdict

from django.db.models import Count
from django.utils import timezone

from apps.intelligence.models import PlatformSettings, PersonalizedRecommendationPushLog
from apps.intelligence.services.recommendation_service import RecommendationService
from apps.line_bot.models import LineUserBinding
from apps.line_bot.services.line_api import LineMessagingAPI
from apps.orders.models import DineInOrder, TakeoutOrder
from apps.stores.models import Store

logger = logging.getLogger(__name__)


class LineRecommendationPushService:
    """平台個人化推薦推播服務（快速備案 + 完整版自動推播）。"""

    def __init__(self):
        self.settings = PlatformSettings.get_settings()
        self.line_api = LineMessagingAPI()
        self.line_api.channel_access_token = self.settings.line_bot_channel_access_token

    def _ensure_line_bot_ready(self):
        if not self.settings.has_line_bot_config():
            raise ValueError('平台 LINE BOT 尚未設定')
        if not self.settings.is_line_bot_enabled:
            raise ValueError('平台 LINE BOT 未啟用')

    def _get_popular_recommended_stores(self, limit=5):
        return list(
            Store.objects.filter(is_published=True)
            .order_by('-surplus_completed_revenue_total', '-surplus_completed_order_count_total', '-created_at')[:limit]
        )

    def _get_personalized_recommended_stores(self, user, limit=5):
        from apps.orders.models import DineInOrder, TakeoutOrder
        from apps.surplus_food.models import SurplusFoodOrder

        store_scores = {}

        takeout_stats = TakeoutOrder.objects.filter(user=user).exclude(status='rejected').values('store_id').annotate(order_count=Count('id'))
        dinein_stats = DineInOrder.objects.filter(user=user).exclude(status='rejected').values('store_id').annotate(order_count=Count('id'))
        surplus_stats = SurplusFoodOrder.objects.filter(user=user).exclude(status__in=['rejected', 'cancelled', 'expired']).values('store_id').annotate(order_count=Count('id'))

        for row in takeout_stats:
            store_scores[row['store_id']] = store_scores.get(row['store_id'], 0) + row['order_count']
        for row in dinein_stats:
            store_scores[row['store_id']] = store_scores.get(row['store_id'], 0) + row['order_count']
        for row in surplus_stats:
            store_scores[row['store_id']] = store_scores.get(row['store_id'], 0) + row['order_count']

        if not store_scores:
            return []

        ranked_store_ids = [
            store_id
            for store_id, _ in sorted(store_scores.items(), key=lambda item: item[1], reverse=True)
        ]

        stores = Store.objects.filter(id__in=ranked_store_ids, is_published=True)
        store_by_id = {store.id: store for store in stores}
        return [store_by_id[store_id] for store_id in ranked_store_ids if store_id in store_by_id][:limit]

    def _build_recommendation_message(self, title, intro, stores, include_popularity_metrics=False):
        if not stores:
            return None

        lines = [title, '', intro]
        for store in stores:
            if include_popularity_metrics:
                donation_amount = float(store.surplus_completed_revenue_total or 0) * 0.6
                completed_orders = store.surplus_completed_order_count_total or 0
                lines.append(
                    f"• {store.name}（捐款 NT$ {donation_amount:,.0f} / 完成單 {completed_orders}）"
                )
            else:
                lines.append(f"• {store.name}")

        return "\n".join(lines)

    def _get_user_personalization_labels(self, user, limit=6):
        labels = []
        seen = set()

        # 1) 食物標籤（從歷史點餐偏好）
        favorite_tags = RecommendationService.get_user_favorite_tags(user, limit=3)
        for item in favorite_tags:
            tag = (item or {}).get('tag')
            if tag and tag not in seen:
                labels.append(tag)
                seen.add(tag)

        # 2) 餐廳類型（從歷史訂單店家）
        cuisine_score = defaultdict(int)
        for row in (
            TakeoutOrder.objects.filter(user=user)
            .exclude(status='rejected')
            .values('store__cuisine_type')
            .annotate(order_count=Count('id'))
        ):
            cuisine_code = row.get('store__cuisine_type')
            if cuisine_code:
                cuisine_score[cuisine_code] += int(row.get('order_count') or 0)

        for row in (
            DineInOrder.objects.filter(user=user)
            .exclude(status='rejected')
            .values('store__cuisine_type')
            .annotate(order_count=Count('id'))
        ):
            cuisine_code = row.get('store__cuisine_type')
            if cuisine_code:
                cuisine_score[cuisine_code] += int(row.get('order_count') or 0)

        cuisine_choices = dict(Store.CUISINE_TYPE_CHOICES)
        sorted_cuisines = sorted(cuisine_score.items(), key=lambda item: item[1], reverse=True)
        for cuisine_code, _ in sorted_cuisines[:2]:
            cuisine_name = cuisine_choices.get(cuisine_code, cuisine_code)
            label = f"{cuisine_name}餐廳"
            if label not in seen:
                labels.append(label)
                seen.add(label)

        # 3) 地區（從歷史訂單店家）
        region_score = defaultdict(int)
        for row in (
            TakeoutOrder.objects.filter(user=user)
            .exclude(status='rejected')
            .values('store__region')
            .annotate(order_count=Count('id'))
        ):
            region = row.get('store__region')
            if region:
                region_score[region] += int(row.get('order_count') or 0)

        for row in (
            DineInOrder.objects.filter(user=user)
            .exclude(status='rejected')
            .values('store__region')
            .annotate(order_count=Count('id'))
        ):
            region = row.get('store__region')
            if region:
                region_score[region] += int(row.get('order_count') or 0)

        sorted_regions = sorted(region_score.items(), key=lambda item: item[1], reverse=True)
        for region, _ in sorted_regions[:2]:
            if region not in seen:
                labels.append(region)
                seen.add(region)

        return labels[:limit]

    def _build_personalized_intro(self, user):
        labels = self._get_user_personalization_labels(user, limit=6)
        label_text = '、'.join(labels) if labels else '美食探索'
        return f"我們發現您你最近對「{label_text}」特別感興趣！我們為你在 DINEVERSE 中找到了幾家符合您喜好的餐廳。找時間去試試看吧！"

    def _log(self, *, binding, push_type, status, reason='', error_message='', store_ids=None):
        PersonalizedRecommendationPushLog.objects.create(
            user=binding.user if binding and binding.user_id else None,
            line_user_id=binding.line_user_id if binding else '',
            push_type=push_type,
            status=status,
            reason=reason,
            error_message=error_message,
            recommended_store_ids=store_ids or [],
        )

    def _is_personalized_eligible(self, binding, now, force=False):
        if force:
            return True, ''

        if not self.settings.is_personalized_recommendation_enabled:
            return False, 'platform_personalized_disabled'

        if not binding.notify_personalized_recommendation:
            return False, 'user_personalized_disabled'

        weekly_limit = int(self.settings.personalized_recommendation_weekly_limit or 0)
        if weekly_limit == 0:
            return False, 'weekly_limit_zero'

        interval_minutes = max(0, int(self.settings.personalized_recommendation_min_interval_minutes or 0))
        if interval_minutes > 0:
            last_personalized = PersonalizedRecommendationPushLog.objects.filter(
                user=binding.user,
                push_type='personalized',
                status='success',
            ).order_by('-created_at').first()
            if last_personalized and now - last_personalized.created_at < timedelta(minutes=interval_minutes):
                return False, 'min_interval_not_reached'

        window_start = now - timedelta(days=7)
        weekly_personalized_count = PersonalizedRecommendationPushLog.objects.filter(
            user=binding.user,
            push_type='personalized',
            status='success',
            created_at__gte=window_start,
        ).count()
        if weekly_personalized_count >= weekly_limit:
            return False, 'weekly_limit_reached'

        return True, ''

    def send_quick_fallback_popular_recommendation(self, intro_message='以下是本週熱門店家推薦，AI 功能異常時可先使用此備案。'):
        """快速版：只送熱門店家（不依賴個人化推薦判斷）。"""
        self._ensure_line_bot_ready()

        bindings = LineUserBinding.objects.filter(is_active=True, current_mode='customer')
        popular_stores = self._get_popular_recommended_stores(limit=5)
        if not popular_stores:
            return {
                'mode': 'quick_fallback',
                'recipient_count': 0,
                'success_count': 0,
                'failure_count': 0,
                'skipped_count': 0,
                'detail': '目前沒有可推薦的熱門店家',
            }

        message_text = self._build_recommendation_message(
            title='🛟 熱門店家備援推薦',
            intro=intro_message,
            stores=popular_stores,
            include_popularity_metrics=True,
        )
        message = self.line_api.create_text_message(message_text)

        success_count = 0
        failure_count = 0
        skipped_count = 0

        for binding in bindings:
            if not binding.notify_personalized_recommendation:
                skipped_count += 1
                self._log(
                    binding=binding,
                    push_type='fallback',
                    status='skipped',
                    reason='user_personalized_disabled',
                )
                continue

            try:
                result = self.line_api.push_message(binding.line_user_id, [message])
                if result:
                    success_count += 1
                    self._log(
                        binding=binding,
                        push_type='fallback',
                        status='success',
                        reason='quick_fallback_popular',
                        store_ids=[store.id for store in popular_stores],
                    )
                else:
                    failure_count += 1
                    self._log(
                        binding=binding,
                        push_type='fallback',
                        status='failed',
                        reason='line_push_failed',
                        store_ids=[store.id for store in popular_stores],
                    )
            except Exception as exc:
                failure_count += 1
                self._log(
                    binding=binding,
                    push_type='fallback',
                    status='failed',
                    reason='line_push_exception',
                    error_message=str(exc),
                    store_ids=[store.id for store in popular_stores],
                )
                logger.warning('Quick fallback push failed for %s: %s', binding.line_user_id, exc)

        return {
            'mode': 'quick_fallback',
            'recipient_count': bindings.count(),
            'success_count': success_count,
            'failure_count': failure_count,
            'skipped_count': skipped_count,
        }

    def run_automated_personalized_recommendation(self, *, force=False):
        """完整版：依最小間隔 + 每週上限，自動送個人化 + 熱門推薦。"""
        self._ensure_line_bot_ready()

        bindings = LineUserBinding.objects.filter(is_active=True, current_mode='customer').select_related('user')
        now = timezone.now()
        popular_stores = self._get_popular_recommended_stores(limit=5)

        success_count = 0
        failure_count = 0
        skipped_count = 0

        for binding in bindings:
            eligible, reason = self._is_personalized_eligible(binding, now, force=force)
            if not eligible:
                skipped_count += 1
                self._log(
                    binding=binding,
                    push_type='personalized',
                    status='skipped',
                    reason=reason,
                )
                continue

            personalized_stores = self._get_personalized_recommended_stores(binding.user, limit=5)
            personalized_text = self._build_recommendation_message(
                title='🎯 個人化推薦店家',
                intro=self._build_personalized_intro(binding.user),
                stores=personalized_stores,
                include_popularity_metrics=False,
            )

            popular_text = self._build_recommendation_message(
                title='🔥 熱門店家推薦',
                intro='以下是目前高捐款金額與高訂單量的熱門店家：',
                stores=popular_stores,
                include_popularity_metrics=True,
            )

            messages = []
            sent_types = []
            if personalized_text:
                messages.append(self.line_api.create_text_message(personalized_text))
                sent_types.append('personalized')
            if popular_text:
                messages.append(self.line_api.create_text_message(popular_text))
                sent_types.append('popular')

            if not messages:
                skipped_count += 1
                self._log(
                    binding=binding,
                    push_type='personalized',
                    status='skipped',
                    reason='no_recommendation_content',
                )
                continue

            try:
                result = self.line_api.push_message(binding.line_user_id, messages[:5])
                if result:
                    success_count += 1
                    if 'personalized' in sent_types:
                        self._log(
                            binding=binding,
                            push_type='personalized',
                            status='success',
                            reason='auto_cycle',
                            store_ids=[store.id for store in personalized_stores],
                        )
                    if 'popular' in sent_types:
                        self._log(
                            binding=binding,
                            push_type='popular',
                            status='success',
                            reason='auto_cycle',
                            store_ids=[store.id for store in popular_stores],
                        )
                else:
                    failure_count += 1
                    if 'personalized' in sent_types:
                        self._log(
                            binding=binding,
                            push_type='personalized',
                            status='failed',
                            reason='line_push_failed',
                            store_ids=[store.id for store in personalized_stores],
                        )
                    if 'popular' in sent_types:
                        self._log(
                            binding=binding,
                            push_type='popular',
                            status='failed',
                            reason='line_push_failed',
                            store_ids=[store.id for store in popular_stores],
                        )
            except Exception as exc:
                failure_count += 1
                if 'personalized' in sent_types:
                    self._log(
                        binding=binding,
                        push_type='personalized',
                        status='failed',
                        reason='line_push_exception',
                        error_message=str(exc),
                        store_ids=[store.id for store in personalized_stores],
                    )
                if 'popular' in sent_types:
                    self._log(
                        binding=binding,
                        push_type='popular',
                        status='failed',
                        reason='line_push_exception',
                        error_message=str(exc),
                        store_ids=[store.id for store in popular_stores],
                    )
                logger.warning('Auto recommendation push failed for %s: %s', binding.line_user_id, exc)

        return {
            'mode': 'full_auto',
            'recipient_count': bindings.count(),
            'success_count': success_count,
            'failure_count': failure_count,
            'skipped_count': skipped_count,
            'force': force,
        }
