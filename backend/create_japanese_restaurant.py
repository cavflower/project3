"""
創建日式料理店的腳本
包含店家資料、菜單商品、營業時段等
"""
import os
import sys
import django

# 設定 Django 環境
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catering_platform_api.settings.development')
django.setup()

from django.contrib.auth import get_user_model
from apps.stores.models import Store
from apps.products.models import Product, ProductCategory
from apps.users.models import Merchant

User = get_user_model()

def create_japanese_restaurant():
    print("🍱 開始創建日式料理店...")
    
    # 1. 使用現有的測試帳號
    print("\n📝 使用現有測試帳號...")
    email = "whisper@gmail.com"
    
    try:
        user = User.objects.get(email=email)
        print(f"✅ 找到現有用戶: {user.username} ({email})")
        print(f"   Firebase UID: {user.firebase_uid}")
        created = False
    except User.DoesNotExist:
        print(f"❌ 找不到帳號: {email}")
        print("請使用其他現有帳號")
        return
    
    # 2. 創建或獲取 Merchant
    print("\n👔 設定商家檔案...")
    merchant, created = Merchant.objects.get_or_create(
        user=user,
        defaults={
            'company_account': '88776655',  # 櫻花日式料理統編
            'plan': 'premium',
        }
    )
    
    if created:
        print(f"✅ 創建商家檔案，統編: {merchant.company_account}")
    else:
        print(f"ℹ️  使用現有商家檔案，統編: {merchant.company_account}")
    
    # 3. 創建店家
    print("\n🏪 創建店家資料...")
    
    # 設定營業時間 JSON
    opening_hours = {
        'monday': {'lunch': {'start': '11:00', 'end': '14:00', 'is_open': True}, 'dinner': {'start': '17:00', 'end': '21:30', 'is_open': True}},
        'tuesday': {'lunch': {'start': '11:00', 'end': '14:00', 'is_open': True}, 'dinner': {'start': '17:00', 'end': '21:30', 'is_open': True}},
        'wednesday': {'lunch': {'start': '11:00', 'end': '14:00', 'is_open': True}, 'dinner': {'start': '17:00', 'end': '21:30', 'is_open': True}},
        'thursday': {'lunch': {'start': '11:00', 'end': '14:00', 'is_open': True}, 'dinner': {'start': '17:00', 'end': '21:30', 'is_open': True}},
        'friday': {'lunch': {'start': '11:00', 'end': '14:00', 'is_open': True}, 'dinner': {'start': '17:00', 'end': '21:30', 'is_open': True}},
        'saturday': {'lunch': {'start': '11:00', 'end': '14:00', 'is_open': True}, 'dinner': {'start': '17:00', 'end': '21:30', 'is_open': True}},
        'sunday': {'lunch': {'start': '11:00', 'end': '14:00', 'is_open': True}, 'dinner': {'start': '17:00', 'end': '21:30', 'is_open': True}},
    }
    
    store, created = Store.objects.get_or_create(
        merchant=merchant,
        defaults={
            'name': '櫻花日式料理',
            'cuisine_type': 'japanese',
            'description': '精選新鮮食材，傳承道地日式料理，提供壽司、丼飯、拉麵等多樣美味。堅持現點現做，每一道料理都是師傅的用心之作。',
            'address': '台北市大安區忠孝東路四段181號',
            'phone': '02-2345-6789',
            'email': 'sakura@example.com',
            'is_open': True,
            'is_published': True,
            'enable_reservation': True,
            'enable_loyalty': True,
            'enable_surplus_food': True,
            'opening_hours': opening_hours,
            'has_wifi': True,
            'has_english_menu': True,
            'suitable_for_children': True,
            'smoking_policy': 'no_smoking',
            'budget_lunch': 250.00,
            'budget_dinner': 350.00,
        }
    )
    
    if created:
        print(f"✅ 創建新店家: {store.name}")
    else:
        print(f"ℹ️  找到現有店家，更新為櫻花日式料理")
        # 更新所有店家資訊
        store.name = '櫻花日式料理'
        store.cuisine_type = 'japanese'
        store.description = '精選新鮮食材，傳承道地日式料理，提供壽司、丼飯、拉麵等多樣美味。堅持現點現做，每一道料理都是師傅的用心之作。'
        store.address = '台北市大安區忠孝東路四段181號'
        store.phone = '02-2345-6789'
        store.email = 'sakura@example.com'
        store.is_open = True
        store.is_published = True
        store.enable_reservation = True
        store.enable_loyalty = True
        store.enable_surplus_food = True
        store.opening_hours = opening_hours
        store.has_wifi = True
        store.has_english_menu = True
        store.suitable_for_children = True
        store.smoking_policy = 'no_smoking'
        store.budget_lunch = 250.00
        store.budget_dinner = 350.00
        store.save()
        print(f"✅ 更新完成: {store.name}")
    
    # 3. 顯示營業時段資訊
    print("\n⏰ 營業時段:")
    print("  週一至週日:")
    print("    午餐: 11:00-14:00")
    print("    晚餐: 17:00-21:30")
    
    # 4. 創建菜單商品
    print("\n🍣 創建菜單商品...")
    
    products_data = [
        # 壽司類
        {
            'name': '綜合握壽司',
            'description': '精選八貫握壽司（鮭魚、鮪魚、蝦、花枝、鮭魚卵等）',
            'price': 380,
            'category': 'sushi',
            'service_type': 'both',
            'is_available': True,
        },
        {
            'name': '鮭魚握壽司',
            'description': '新鮮鮭魚握壽司 2貫',
            'price': 120,
            'category': 'sushi',
            'service_type': 'both',
            'is_available': True,
        },
        {
            'name': '炙燒鮭魚腹壽司',
            'description': '炙燒鮭魚腹握壽司 2貫，油脂豐富',
            'price': 180,
            'category': 'sushi',
            'service_type': 'both',
            'is_available': True,
        },
        {
            'name': '加州卷',
            'description': '蟹肉棒、酪梨、小黃瓜，外層包覆魚卵',
            'price': 150,
            'category': 'sushi',
            'service_type': 'both',
            'is_available': True,
        },
        
        # 丼飯類
        {
            'name': '鮭魚親子丼',
            'description': '新鮮鮭魚生魚片搭配鮭魚卵，附味噌湯、小菜',
            'price': 280,
            'category': 'donburi',
            'service_type': 'both',
            'is_available': True,
        },
        {
            'name': '日式炸豬排丼',
            'description': '香酥炸豬排配上特製醬汁和溏心蛋，附味噌湯、小菜',
            'price': 250,
            'category': 'donburi',
            'service_type': 'both',
            'is_available': True,
        },
        {
            'name': '牛丼',
            'description': '滑嫩牛肉片搭配洋蔥，附味噌湯、小菜',
            'price': 220,
            'category': 'donburi',
            'service_type': 'both',
            'is_available': True,
        },
        {
            'name': '海鮮丼',
            'description': '綜合生魚片（鮭魚、鮪魚、甜蝦、花枝等），附味噌湯、小菜',
            'price': 350,
            'category': 'donburi',
            'service_type': 'both',
            'is_available': True,
        },
        
        # 拉麵類
        {
            'name': '豚骨拉麵',
            'description': '濃郁豚骨湯底，叉燒、溏心蛋、筍乾、海苔',
            'price': 200,
            'category': 'ramen',
            'service_type': 'both',
            'is_available': True,
        },
        {
            'name': '味噌拉麵',
            'description': '北海道風味味噌湯底，配料豐富',
            'price': 210,
            'category': 'ramen',
            'service_type': 'both',
            'is_available': True,
        },
        {
            'name': '醬油拉麵',
            'description': '清爽醬油湯底，傳統口味',
            'price': 190,
            'category': 'ramen',
            'service_type': 'both',
            'is_available': True,
        },
        {
            'name': '辣味拉麵',
            'description': '特調辣味湯底，喜愛重口味的首選',
            'price': 220,
            'category': 'ramen',
            'service_type': 'both',
            'is_available': True,
        },
        
        # 定食類
        {
            'name': '鹽烤鯖魚定食',
            'description': '新鮮鯖魚鹽烤，附白飯、味噌湯、小菜三樣',
            'price': 260,
            'category': 'teishoku',
            'service_type': 'both',
            'is_available': True,
        },
        {
            'name': '照燒雞腿定食',
            'description': '香嫩雞腿肉照燒，附白飯、味噌湯、小菜三樣',
            'price': 240,
            'category': 'teishoku',
            'service_type': 'both',
            'is_available': True,
        },
        {
            'name': '天婦羅定食',
            'description': '綜合天婦羅（蝦、蔬菜），附白飯、味噌湯、小菜三樣',
            'price': 280,
            'category': 'teishoku',
            'service_type': 'both',
            'is_available': True,
        },
        
        # 單點小菜
        {
            'name': '日式煎餃',
            'description': '香酥煎餃 6個',
            'price': 80,
            'category': 'side',
            'service_type': 'both',
            'is_available': True,
        },
        {
            'name': '唐揚雞',
            'description': '日式炸雞塊',
            'price': 100,
            'category': 'side',
            'service_type': 'both',
            'is_available': True,
        },
        {
            'name': '毛豆',
            'description': '鹽味毛豆',
            'price': 60,
            'category': 'side',
            'service_type': 'both',
            'is_available': True,
        },
        {
            'name': '海帶芽味噌湯',
            'description': '經典日式味噌湯',
            'price': 40,
            'category': 'side',
            'service_type': 'both',
            'is_available': True,
        },
        
        # 飲料
        {
            'name': '日式綠茶',
            'description': '冷/熱',
            'price': 30,
            'category': 'beverage',
            'service_type': 'both',
            'is_available': True,
        },
        {
            'name': '可爾必思',
            'description': '經典日式乳酸飲料',
            'price': 50,
            'category': 'beverage',
            'service_type': 'both',
            'is_available': True,
        },
        {
            'name': '柚子茶',
            'description': '清爽柚子風味',
            'price': 60,
            'category': 'beverage',
            'service_type': 'both',
            'is_available': True,
        },
    ]
    
    # 4. 創建產品分類
    print("\n📂 創建產品分類...")
    categories_data = [
        {'name': '壽司', 'code': 'sushi', 'display_order': 1},
        {'name': '丼飯', 'code': 'donburi', 'display_order': 2},
        {'name': '拉麵', 'code': 'ramen', 'display_order': 3},
        {'name': '定食', 'code': 'teishoku', 'display_order': 4},
        {'name': '小菜', 'code': 'side', 'display_order': 5},
        {'name': '飲料', 'code': 'beverage', 'display_order': 6},
    ]
    
    categories = {}
    for cat_data in categories_data:
        category, created = ProductCategory.objects.get_or_create(
            store=store,
            name=cat_data['name'],
            defaults={
                'display_order': cat_data['display_order'],
                'is_active': True,
            }
        )
        categories[cat_data['code']] = category
        if created:
            print(f"  ✅ {category.name}")
    
    # 5. 創建商品
    print("\n🍱 創建商品...")
    created_count = 0
    for product_data in products_data:
        # 取得分類
        category_code = product_data.pop('category', None)
        category = categories.get(category_code) if category_code else None
        
        product, created = Product.objects.get_or_create(
            store=store,
            name=product_data['name'],
            defaults={
                **product_data,
                'merchant': merchant,
                'category': category,
            }
        )
        if created:
            created_count += 1
            print(f"  ✅ {product.name} - NT${product.price}")
    
    print(f"\n✅ 共創建 {created_count} 個商品")
    
    # 6. 顯示登入資訊
    print("\n" + "="*60)
    print("🎉 日式料理店創建完成！")
    print("="*60)
    print(f"\n店家名稱: {store.name}")
    print(f"店家地址: {store.address}")
    print(f"店家電話: {store.phone}")
    print(f"\n🔐 前端登入資訊:")
    print(f"  Email: {user.email}")
    print(f"  使用者名稱: {user.username}")
    print(f"  Firebase UID: {user.firebase_uid}")
    print(f"\n💡 如何登入:")
    print(f"  1. 前往商家登入頁面")
    print(f"  2. 使用 Firebase 登入: {user.email}")
    print(f"  3. 登入後即可看到「櫻花日式料理」的完整資料")
    print(f"\n功能啟用:")
    print(f"  ✅ 訂位功能")
    print(f"  ✅ 會員功能")
    print(f"  ✅ 惜福品功能")
    print(f"\n📊 資料統計:")
    print(f"  商品總數: {Product.objects.filter(store=store).count()} 項")
    print(f"  分類總數: {ProductCategory.objects.filter(store=store).count()} 類")
    print(f"\n⏰ 營業時段: 週一至週日")
    print(f"  午餐: 11:00-14:00")
    print(f"  晚餐: 17:00-21:30")
    print("\n" + "="*60)

if __name__ == '__main__':
    try:
        create_japanese_restaurant()
    except Exception as e:
        print(f"\n❌ 錯誤: {e}")
        import traceback
        traceback.print_exc()
