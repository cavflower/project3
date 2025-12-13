"""
為櫻花日式料理創建測試兌換商品
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catering_platform_api.settings.development')
django.setup()

from apps.loyalty.models import RedemptionProduct
from apps.stores.models import Store

def create_test_redemption_products():
    # 查找櫻花日式料理
    try:
        store = Store.objects.get(name='櫻花日式料理')
        print(f"找到店家：{store.name}")
    except Store.DoesNotExist:
        print("找不到櫻花日式料理")
        return
    
    # 檢查是否已經有兌換商品
    existing_products = RedemptionProduct.objects.filter(store=store)
    if existing_products.exists():
        print(f"\n店家已有 {existing_products.count()} 個兌換商品：")
        for product in existing_products:
            print(f"  - {product.title}: {product.required_points}點")
        
        choice = input("\n是否要創建更多商品？(y/n): ")
        if choice.lower() != 'y':
            return
    
    # 創建測試兌換商品
    test_products = [
        {
            'title': '$50 優惠券',
            'description': '可折抵50元消費，單次使用',
            'required_points': 50,
            'inventory': None,  # 無限制
            'is_active': True
        },
        {
            'title': '$100 優惠券',
            'description': '可折抵100元消費，單次使用',
            'required_points': 100,
            'inventory': None,
            'is_active': True
        },
        {
            'title': '免費飲料一杯',
            'description': '可兌換任意飲料一杯',
            'required_points': 30,
            'inventory': 50,  # 限量50份
            'is_active': True
        },
        {
            'title': '招牌料理免費',
            'description': '免費享用一份招牌料理',
            'required_points': 200,
            'inventory': 20,  # 限量20份
            'is_active': True
        },
    ]
    
    print("\n=== 創建兌換商品 ===")
    created_count = 0
    
    for product_data in test_products:
        product = RedemptionProduct.objects.create(
            store=store,
            **product_data
        )
        print(f"✓ 創建成功：{product.title} ({product.required_points}點)")
        created_count += 1
    
    print(f"\n✓ 成功創建 {created_count} 個兌換商品！")
    
    # 顯示所有兌換商品
    all_products = RedemptionProduct.objects.filter(store=store)
    print(f"\n店家目前共有 {all_products.count()} 個兌換商品：")
    for product in all_products:
        status = "啟用" if product.is_active else "停用"
        inventory_text = f"庫存: {product.inventory}" if product.inventory else "無限制"
        print(f"  - {product.title}: {product.required_points}點 [{status}] [{inventory_text}]")

if __name__ == '__main__':
    create_test_redemption_products()
