"""
刪除除了 whisper@gmail.com 以外的櫻花日式料理店家
"""
import os
import sys
import django

# 設定 Django 環境
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catering_platform_api.settings.development')
django.setup()

from apps.stores.models import Store
from apps.products.models import Product, ProductCategory

def delete_duplicate_stores():
    # 查詢除了 whisper@gmail.com 以外的櫻花日式料理店家
    stores_to_delete = Store.objects.filter(name='櫻花日式料理').exclude(merchant__user__email='whisper@gmail.com')
    
    print(f'找到 {stores_to_delete.count()} 個要刪除的店家:\n')
    
    for store in stores_to_delete:
        print(f'店家: {store.name}')
        print(f'  Email: {store.merchant.user.email}')
        print(f'  Username: {store.merchant.user.username}')
        
        # 統計要刪除的資料
        products = Product.objects.filter(store=store)
        categories = ProductCategory.objects.filter(store=store)
        
        print(f'  包含: {products.count()} 個商品, {categories.count()} 個分類')
        print()
    
    # 自動確認刪除
    confirm = 'yes'
    
    if confirm.lower() == 'yes':
        deleted_count = 0
        for store in stores_to_delete:
            email = store.merchant.user.email
            name = store.name
            
            # 刪除關聯資料
            Product.objects.filter(store=store).delete()
            ProductCategory.objects.filter(store=store).delete()
            
            # 刪除店家
            store.delete()
            deleted_count += 1
            print(f'✅ 已刪除: {name} ({email})')
        
        print(f'\n✅ 總共刪除了 {deleted_count} 個店家！')
    else:
        print('取消刪除操作')

if __name__ == '__main__':
    delete_duplicate_stores()
