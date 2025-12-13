"""
創建點數規則的腳本
用於測試點數累積功能
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catering_platform_api.settings')
django.setup()

from apps.loyalty.models import PointRule
from apps.stores.models import Store

def create_point_rule():
    # 查找櫻花日式料理
    try:
        store = Store.objects.get(name='櫻花日式料理')
        print(f"找到店家：{store.name}")
    except Store.DoesNotExist:
        print("找不到櫻花日式料理")
        return
    
    # 檢查是否已經有點數規則
    existing_rules = PointRule.objects.filter(store=store)
    if existing_rules.exists():
        print(f"\n店家已有 {existing_rules.count()} 個點數規則：")
        for rule in existing_rules:
            print(f"  - {rule.name}: 每消費1元得{rule.points_per_currency}點，最低消費${rule.min_spend or 0}元")
        
        choice = input("\n是否要創建新規則？(y/n): ")
        if choice.lower() != 'y':
            return
    
    # 創建新的點數規則
    print("\n=== 創建新的點數規則 ===")
    name = input("規則名稱（例如：基本點數規則）: ") or "基本點數規則"
    points_per_currency = input("每消費1元得幾點（例如：0.01 表示每100元得1點）: ") or "0.01"
    min_spend = input("最低消費金額（直接按Enter表示無限制）: ") or "0"
    
    rule = PointRule.objects.create(
        store=store,
        name=name,
        points_per_currency=float(points_per_currency),
        min_spend=float(min_spend) if min_spend else 0,
        active=True
    )
    
    print(f"\n✓ 點數規則創建成功！")
    print(f"  規則名稱：{rule.name}")
    print(f"  每消費1元得：{rule.points_per_currency} 點")
    print(f"  最低消費：${rule.min_spend or 0} 元")
    print(f"  狀態：{'啟用' if rule.active else '停用'}")
    
    # 計算範例
    print(f"\n範例計算：")
    print(f"  消費 $100 可獲得 {int(100 * rule.points_per_currency)} 點")
    print(f"  消費 $500 可獲得 {int(500 * rule.points_per_currency)} 點")
    print(f"  消費 $1000 可獲得 {int(1000 * rule.points_per_currency)} 點")

if __name__ == '__main__':
    create_point_rule()
