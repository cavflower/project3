"""
財務分析服務
為店家提供銷售數據聚合和 AI 分析報告
"""
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional
from django.db.models import Sum, Count, Avg, F
from django.db.models.functions import TruncDate, TruncHour, ExtractWeekDay
from django.utils import timezone

from apps.orders.models import TakeoutOrder, TakeoutOrderItem, DineInOrder, DineInOrderItem
from apps.products.models import Product
from apps.stores.models import Store

logger = logging.getLogger(__name__)


class FinancialAnalysisService:
    """
    財務分析服務
    提供銷售數據聚合和 AI 報告生成
    """
    
    def __init__(self, store: Store):
        self.store = store
    
    def get_sales_summary(
        self,
        start_date: datetime = None,
        end_date: datetime = None,
        period: str = 'week'  # 'day', 'week', 'month'
    ) -> Dict:
        """
        取得銷售摘要
        
        Args:
            start_date: 開始日期
            end_date: 結束日期
            period: 統計週期
            
        Returns:
            Dict: 銷售摘要資料
        """
        # 設定預設日期範圍
        if not end_date:
            end_date = timezone.now()
        if not start_date:
            if period == 'day':
                start_date = end_date - timedelta(days=1)
            elif period == 'week':
                start_date = end_date - timedelta(days=7)
            else:  # month
                start_date = end_date - timedelta(days=30)
        
        # 外帶訂單統計
        takeout_stats = self._get_order_stats(
            TakeoutOrder, TakeoutOrderItem,
            start_date, end_date
        )
        
        # 內用訂單統計
        dinein_stats = self._get_order_stats(
            DineInOrder, DineInOrderItem,
            start_date, end_date,
            is_dinein=True
        )
        
        # 合併統計
        total_revenue = takeout_stats['revenue'] + dinein_stats['revenue']
        total_orders = takeout_stats['order_count'] + dinein_stats['order_count']
        avg_order_value = total_revenue / total_orders if total_orders > 0 else Decimal('0')
        
        # 熱銷商品排行
        top_products = self._get_top_products(start_date, end_date, limit=10)
        
        # 銷售時段分析
        hourly_sales = self._get_hourly_sales(start_date, end_date)
        
        # 每日銷售趨勢
        daily_sales = self._get_daily_sales(start_date, end_date)
        
        return {
            'period': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat(),
                'type': period
            },
            'summary': {
                'total_revenue': float(total_revenue),
                'total_orders': total_orders,
                'avg_order_value': float(avg_order_value),
                'takeout_orders': takeout_stats['order_count'],
                'takeout_revenue': float(takeout_stats['revenue']),
                'dinein_orders': dinein_stats['order_count'],
                'dinein_revenue': float(dinein_stats['revenue']),
            },
            'top_products': top_products,
            'hourly_sales': hourly_sales,
            'daily_sales': daily_sales,
        }
    
    def _get_order_stats(
        self,
        order_model,
        item_model,
        start_date: datetime,
        end_date: datetime,
        is_dinein: bool = False
    ) -> Dict:
        """取得訂單統計"""
        # 只統計已完成的訂單
        completed_statuses = ['completed', 'ready'] if is_dinein else ['completed']
        
        orders = order_model.objects.filter(
            store=self.store,
            created_at__gte=start_date,
            created_at__lte=end_date,
            status__in=completed_statuses
        )
        
        order_count = orders.count()
        
        # 計算總營收（從訂單項目計算）
        order_ids = orders.values_list('id', flat=True)
        revenue = item_model.objects.filter(
            order_id__in=order_ids
        ).aggregate(
            total=Sum(F('unit_price') * F('quantity'))
        )['total'] or Decimal('0')
        
        return {
            'order_count': order_count,
            'revenue': revenue
        }
    
    def _get_top_products(
        self,
        start_date: datetime,
        end_date: datetime,
        limit: int = 10
    ) -> List[Dict]:
        """取得熱銷商品排行"""
        # 外帶訂單商品
        takeout_items = TakeoutOrderItem.objects.filter(
            order__store=self.store,
            order__created_at__gte=start_date,
            order__created_at__lte=end_date,
            order__status='completed'
        ).values('product_id', 'product__name').annotate(
            quantity_sold=Sum('quantity'),
            revenue=Sum(F('unit_price') * F('quantity'))
        )
        
        # 內用訂單商品
        dinein_items = DineInOrderItem.objects.filter(
            order__store=self.store,
            order__created_at__gte=start_date,
            order__created_at__lte=end_date,
            order__status__in=['completed', 'ready']
        ).values('product_id', 'product__name').annotate(
            quantity_sold=Sum('quantity'),
            revenue=Sum(F('unit_price') * F('quantity'))
        )
        
        # 合併統計
        product_stats = {}
        for item in takeout_items:
            pid = item['product_id']
            if pid not in product_stats:
                product_stats[pid] = {
                    'product_id': pid,
                    'product_name': item['product__name'],
                    'quantity_sold': 0,
                    'revenue': Decimal('0')
                }
            product_stats[pid]['quantity_sold'] += item['quantity_sold'] or 0
            product_stats[pid]['revenue'] += item['revenue'] or Decimal('0')
        
        for item in dinein_items:
            pid = item['product_id']
            if pid not in product_stats:
                product_stats[pid] = {
                    'product_id': pid,
                    'product_name': item['product__name'],
                    'quantity_sold': 0,
                    'revenue': Decimal('0')
                }
            product_stats[pid]['quantity_sold'] += item['quantity_sold'] or 0
            product_stats[pid]['revenue'] += item['revenue'] or Decimal('0')
        
        # 排序並取前 N 名
        sorted_products = sorted(
            product_stats.values(),
            key=lambda x: x['quantity_sold'],
            reverse=True
        )[:limit]
        
        # 轉換 Decimal 為 float
        for p in sorted_products:
            p['revenue'] = float(p['revenue'])
        
        return sorted_products
    
    def _get_hourly_sales(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict]:
        """取得各時段銷售統計"""
        hourly_data = {}
        
        # 初始化 24 小時
        for hour in range(24):
            hourly_data[hour] = {'hour': hour, 'orders': 0, 'revenue': Decimal('0')}
        
        # 外帶訂單
        takeout_hourly = TakeoutOrder.objects.filter(
            store=self.store,
            created_at__gte=start_date,
            created_at__lte=end_date,
            status='completed'
        ).annotate(
            hour=TruncHour('created_at')
        ).values('hour').annotate(
            count=Count('id')
        )
        
        for item in takeout_hourly:
            if item['hour']:
                h = item['hour'].hour
                hourly_data[h]['orders'] += item['count']
        
        # 內用訂單
        dinein_hourly = DineInOrder.objects.filter(
            store=self.store,
            created_at__gte=start_date,
            created_at__lte=end_date,
            status__in=['completed', 'ready']
        ).annotate(
            hour=TruncHour('created_at')
        ).values('hour').annotate(
            count=Count('id')
        )
        
        for item in dinein_hourly:
            if item['hour']:
                h = item['hour'].hour
                hourly_data[h]['orders'] += item['count']
        
        return list(hourly_data.values())
    
    def _get_daily_sales(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict]:
        """取得每日銷售統計"""
        daily_data = {}
        
        # 外帶訂單每日統計
        takeout_daily = TakeoutOrder.objects.filter(
            store=self.store,
            created_at__gte=start_date,
            created_at__lte=end_date,
            status='completed'
        ).annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            count=Count('id')
        ).order_by('date')
        
        for item in takeout_daily:
            date_str = item['date'].isoformat() if item['date'] else 'unknown'
            if date_str not in daily_data:
                daily_data[date_str] = {'date': date_str, 'orders': 0, 'revenue': 0}
            daily_data[date_str]['orders'] += item['count']
        
        # 內用訂單每日統計
        dinein_daily = DineInOrder.objects.filter(
            store=self.store,
            created_at__gte=start_date,
            created_at__lte=end_date,
            status__in=['completed', 'ready']
        ).annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            count=Count('id')
        ).order_by('date')
        
        for item in dinein_daily:
            date_str = item['date'].isoformat() if item['date'] else 'unknown'
            if date_str not in daily_data:
                daily_data[date_str] = {'date': date_str, 'orders': 0, 'revenue': 0}
            daily_data[date_str]['orders'] += item['count']
        
        # 按日期排序
        return sorted(daily_data.values(), key=lambda x: x['date'])
    
    def generate_ai_analysis(self, sales_data: Dict) -> str:
        """
        使用 AI 生成分析報告
        
        Args:
            sales_data: 銷售摘要資料
            
        Returns:
            str: AI 生成的分析報告
        """
        try:
            from apps.intelligence.models import PlatformSettings
            
            settings = PlatformSettings.get_settings()
            if not settings.has_ai_config():
                return "AI 服務尚未配置，請聯繫平台管理員。"
            
            # 建立分析提示詞
            prompt = self._build_analysis_prompt(sales_data)
            
            # 根據 AI 提供商呼叫對應的 API
            if settings.ai_provider == 'gemini':
                return self._call_gemini_api(settings, prompt)
            elif settings.ai_provider == 'openai':
                return self._call_openai_api(settings, prompt)
            elif settings.ai_provider == 'groq':
                return self._call_groq_api(settings, prompt)
            else:
                return "不支援的 AI 提供商。"
                
        except Exception as e:
            logger.error(f"AI analysis error: {e}")
            return f"AI 分析發生錯誤：{str(e)}"
    
    def _build_analysis_prompt(self, sales_data: Dict) -> str:
        """建立分析提示詞"""
        summary = sales_data.get('summary', {})
        top_products = sales_data.get('top_products', [])
        hourly_sales = sales_data.get('hourly_sales', [])
        
        # 找出尖峰和低谷時段
        peak_hours = sorted(hourly_sales, key=lambda x: x['orders'], reverse=True)[:3]
        low_hours = sorted(hourly_sales, key=lambda x: x['orders'])[:3]
        
        prompt = f"""你是一位專業的餐飲業經營顧問。請根據以下銷售數據，為店家提供簡潔的經營分析和建議。

## 銷售數據摘要
- 統計期間：{sales_data.get('period', {}).get('type', '週')}報表
- 總營收：${summary.get('total_revenue', 0):,.0f}
- 總訂單數：{summary.get('total_orders', 0)} 筆
- 平均客單價：${summary.get('avg_order_value', 0):,.0f}
- 外帶訂單：{summary.get('takeout_orders', 0)} 筆（${summary.get('takeout_revenue', 0):,.0f}）
- 內用訂單：{summary.get('dinein_orders', 0)} 筆（${summary.get('dinein_revenue', 0):,.0f}）

## 熱銷商品 TOP 5
"""
        for i, p in enumerate(top_products[:5], 1):
            prompt += f"{i}. {p['product_name']} - 銷售 {p['quantity_sold']} 份（${p['revenue']:,.0f}）\n"
        
        prompt += f"""
## 尖峰時段
"""
        for h in peak_hours:
            prompt += f"- {h['hour']:02d}:00 - {h['orders']} 筆訂單\n"
        
        prompt += f"""
## 低谷時段
"""
        for h in low_hours:
            prompt += f"- {h['hour']:02d}:00 - {h['orders']} 筆訂單\n"
        
        prompt += """
請提供：
1. 📊 銷售表現評估（2-3 句）
2. 🏆 熱銷商品分析（1-2 句）
3. ⏰ 營業時段建議（1-2 句）
4. 💡 經營改善建議（2-3 條具體建議）

請使用繁體中文，回覆簡潔有力，適合店家快速閱讀。"""
        
        return prompt
    
    def _call_gemini_api(self, settings, prompt: str) -> str:
        """呼叫 Gemini API"""
        import requests
        
        model_name = settings.ai_model
        if not model_name.startswith('models/'):
            model_name = f'models/{model_name}'
        
        url = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent?key={settings.ai_api_key}"
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": float(settings.ai_temperature),
                "maxOutputTokens": settings.ai_max_tokens
            }
        }
        
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        return result['candidates'][0]['content']['parts'][0]['text']
    
    def _call_openai_api(self, settings, prompt: str) -> str:
        """呼叫 OpenAI API"""
        import openai
        openai.api_key = settings.ai_api_key
        
        response = openai.ChatCompletion.create(
            model=settings.ai_model,
            messages=[
                {"role": "system", "content": "你是一位專業的餐飲業經營顧問。"},
                {"role": "user", "content": prompt}
            ],
            temperature=float(settings.ai_temperature),
            max_tokens=settings.ai_max_tokens
        )
        
        return response.choices[0].message.content
    
    def _call_groq_api(self, settings, prompt: str) -> str:
        """呼叫 Groq API"""
        from groq import Groq
        
        client = Groq(api_key=settings.ai_api_key)
        
        completion = client.chat.completions.create(
            model=settings.ai_model,
            messages=[
                {"role": "system", "content": "你是一位專業的餐飲業經營顧問。"},
                {"role": "user", "content": prompt}
            ],
            temperature=float(settings.ai_temperature),
            max_tokens=settings.ai_max_tokens
        )
        
        return completion.choices[0].message.content
