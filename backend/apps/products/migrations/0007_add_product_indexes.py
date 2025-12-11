# Generated migration for adding indexes to Product model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0006_remove_takeoutorderitem_order_and_more'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='product',
            options={'ordering': ['-created_at'], 'verbose_name': '產品', 'verbose_name_plural': '產品'},
        ),
        migrations.AddIndex(
            model_name='product',
            index=models.Index(fields=['store', 'is_available'], name='products_store_avail_idx'),
        ),
        migrations.AddIndex(
            model_name='product',
            index=models.Index(fields=['store', 'service_type', 'is_available'], name='products_store_service_idx'),
        ),
        migrations.AddIndex(
            model_name='product',
            index=models.Index(fields=['category', 'is_available'], name='products_category_idx'),
        ),
        migrations.AlterModelTable(
            name='product',
            table='products',
        ),
    ]
