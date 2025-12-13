"""
LINE Webhook 測試工具
用於本地測試 FAQ 匹配和 AI 回覆功能
"""
import os
import django

# 設定 Django 環境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catering_platform_api.settings.development')
django.setup()

from apps.line_bot.models import StoreLineBotConfig, StoreFAQ
from apps.line_bot.services.message_handler import MessageHandler
from apps.stores.models import Store


def test_faq_matching():
    """測試 FAQ 匹配功能"""
    print("=" * 50)
    print("LINE BOT FAQ 測試工具")
    print("=" * 50)
    
    # 取得第一個店家（您的店家）
    try:
        store = Store.objects.first()
        if not store:
            print("❌ 找不到店家資料")
            return
        
        print(f"✅ 店家：{store.name}")
        
        # 檢查 LINE BOT 設定
        try:
            config = StoreLineBotConfig.objects.get(store=store)
            print(f"✅ LINE BOT 設定：{'已啟用' if config.is_active else '未啟用'}")
        except StoreLineBotConfig.DoesNotExist:
            print("❌ 尚未設定 LINE BOT")
            print("請先到「LINE BOT 設定」頁面完成設定")
            return
        
        # 檢查 FAQ
        faqs = StoreFAQ.objects.filter(store=store, is_active=True)
        print(f"✅ FAQ 數量：{faqs.count()}")
        
        if faqs.count() == 0:
            print("❌ 尚未建立 FAQ")
            return
        
        print("\n可用的 FAQ：")
        for faq in faqs:
            print(f"  • 問題：{faq.question}")
            print(f"    答案：{faq.answer}")
            print(f"    關鍵字：{faq.keywords}")
            print()
        
        # 初始化訊息處理器
        handler = MessageHandler(config)
        
        store_info = {
            'id': store.id,
            'name': store.name,
            'cuisine_type': store.get_cuisine_type_display() if hasattr(store, 'get_cuisine_type_display') else '',
            'address': store.address,
            'phone': store.phone,
            'opening_hours': store.opening_hours,
            'description': store.description,
        }
        
        # 測試訊息
        print("=" * 50)
        print("開始測試訊息匹配")
        print("=" * 50)
        
        test_messages = [
            "營業時間",
            "營業",
            "幾點開",
            "你好",
            "推薦餐點",
        ]
        
        for msg in test_messages:
            print(f"\n用戶：{msg}")
            result = handler.handle_text_message(
                line_user_id='test_user',
                message=msg,
                store_id=store.id,
                store_info=store_info
            )
            
            if result.get('matched_faq_id'):
                print(f"✅ FAQ 匹配成功")
                print(f"回覆：{result['reply']}")
            elif result.get('used_ai'):
                print(f"🤖 AI 回覆")
                print(f"回覆：{result['reply']}")
            else:
                print(f"⚠️ 無匹配 FAQ，使用預設回覆")
                print(f"回覆：{result['reply']}")
        
    except Exception as e:
        print(f"❌ 錯誤：{e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    test_faq_matching()
