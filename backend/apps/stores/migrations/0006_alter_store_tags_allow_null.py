# Generated manually to fix tags field
from django.db import migrations, models


def set_default_tags(apps, schema_editor):
    """為所有現有的店家設定預設的空標籤列表"""
    Store = apps.get_model('stores', 'Store')
    # 更新所有 tags 為 NULL 或空的記錄
    Store.objects.filter(tags__isnull=True).update(tags=[])


class Migration(migrations.Migration):

    dependencies = [
        ('stores', '0005_store_tags'),
    ]

    operations = [
        # 先執行資料遷移，設定預設值
        migrations.RunPython(set_default_tags, migrations.RunPython.noop),
        
        # 然後修改欄位定義，確保允許空值
        migrations.AlterField(
            model_name='store',
            name='tags',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Tags for categorizing and searching the store (e.g., ['Italian', 'Pizza', 'Romantic']).",
                verbose_name='標籤',
                null=True  # 允許 NULL
            ),
        ),
    ]
