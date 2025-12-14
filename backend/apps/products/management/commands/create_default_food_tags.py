from django.core.management.base import BaseCommand
from apps.products.models import FoodTag


class Command(BaseCommand):
    help = '建立預設的食物標籤'

    def handle(self, *args, **options):
        # 預設食物標籤清單
        default_tags = [
            # 口味特性
            {'name': '辣', 'description': '辛辣口味', 'color': '#EF4444'},
            {'name': '甜', 'description': '甜味', 'color': '#F59E0B'},
            {'name': '鹹', 'description': '鹹味', 'color': '#6B7280'},
            {'name': '酸', 'description': '酸味', 'color': '#FBBF24'},
            {'name': '微辣', 'description': '微辣口味', 'color': '#FB923C'},
            {'name': '重辣', 'description': '重辣口味', 'color': '#DC2626'},
            
            # 肉類
            {'name': '牛肉', 'description': '含有牛肉', 'color': '#7C2D12'},
            {'name': '豬肉', 'description': '含有豬肉', 'color': '#BE185D'},
            {'name': '雞肉', 'description': '含有雞肉', 'color': '#C2410C'},
            {'name': '羊肉', 'description': '含有羊肉', 'color': '#831843'},
            {'name': '海鮮', 'description': '含有海鮮', 'color': '#0891B2'},
            {'name': '魚', 'description': '含有魚肉', 'color': '#0E7490'},
            {'name': '蝦', 'description': '含有蝦', 'color': '#06B6D4'},
            
            # 飲食偏好
            {'name': '素食', 'description': '素食選項', 'color': '#16A34A'},
            {'name': '全素', 'description': '全素（純素）', 'color': '#15803D'},
            {'name': '蛋奶素', 'description': '蛋奶素', 'color': '#22C55E'},
            {'name': '健康', 'description': '健康選擇', 'color': '#10B981'},
            {'name': '低卡', 'description': '低卡路里', 'color': '#059669'},
            {'name': '高蛋白', 'description': '高蛋白質', 'color': '#047857'},
            
            # 過敏原提醒
            {'name': '含堅果', 'description': '含有堅果類', 'color': '#92400E'},
            {'name': '含乳製品', 'description': '含有乳製品', 'color': '#F59E0B'},
            {'name': '含麩質', 'description': '含有麩質', 'color': '#D97706'},
            {'name': '無麩質', 'description': '無麩質', 'color': '#84CC16'},
            
            # 烹飪方式
            {'name': '油炸', 'description': '油炸烹調', 'color': '#CA8A04'},
            {'name': '清蒸', 'description': '清蒸烹調', 'color': '#0891B2'},
            {'name': '燒烤', 'description': '燒烤烹調', 'color': '#B45309'},
            {'name': '炒', 'description': '快炒烹調', 'color': '#EA580C'},
            {'name': '燉', 'description': '燉煮烹調', 'color': '#9A3412'},
            
            # 溫度
            {'name': '冰涼', 'description': '冰涼飲品/食物', 'color': '#0EA5E9'},
            {'name': '溫熱', 'description': '溫熱食物', 'color': '#F97316'},
            {'name': '熱騰騰', 'description': '熱騰騰的食物', 'color': '#DC2626'},
            
            # 餐點類型
            {'name': '主食', 'description': '主食類', 'color': '#78350F'},
            {'name': '小菜', 'description': '小菜/配菜', 'color': '#65A30D'},
            {'name': '湯品', 'description': '湯類', 'color': '#0284C7'},
            {'name': '飲料', 'description': '飲品', 'color': '#0E7490'},
            {'name': '甜點', 'description': '甜點類', 'color': '#DB2777'},
            {'name': '點心', 'description': '點心類', 'color': '#C026D3'},
            
            # 份量
            {'name': '大份', 'description': '大份量', 'color': '#0F766E'},
            {'name': '適中', 'description': '適中份量', 'color': '#0D9488'},
            {'name': '小份', 'description': '小份量', 'color': '#14B8A6'},
            
            # 特色
            {'name': '招牌', 'description': '店家招牌商品', 'color': '#DC2626'},
            {'name': '新品', 'description': '新上市商品', 'color': '#F59E0B'},
            {'name': '季節限定', 'description': '季節限定商品', 'color': '#8B5CF6'},
            {'name': '人氣', 'description': '人氣商品', 'color': '#EC4899'},
        ]
        
        created_count = 0
        existing_count = 0
        
        for tag_data in default_tags:
            tag, created = FoodTag.objects.get_or_create(
                name=tag_data['name'],
                defaults={
                    'description': tag_data['description'],
                    'color': tag_data['color'],
                    'is_active': True
                }
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'✓ 建立標籤: {tag.name}')
                )
            else:
                existing_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n完成！建立了 {created_count} 個新標籤，{existing_count} 個標籤已存在'
            )
        )
