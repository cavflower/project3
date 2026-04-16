from django.db import migrations, models
import django.db.models.deletion


def _safe_product_image(product):
    image = getattr(product, 'image', None)
    if not image:
        return ''
    try:
        return image.url
    except Exception:
        return ''


def backfill_order_item_snapshots(apps, schema_editor):
    for model_name in ('TakeoutOrderItem', 'DineInOrderItem'):
        item_model = apps.get_model('orders', model_name)
        to_update = []

        queryset = item_model.objects.select_related('product').filter(product_id__isnull=False)
        for item in queryset.iterator():
            product = item.product
            if product is None:
                continue

            changed = False
            if item.snapshot_product_id is None:
                item.snapshot_product_id = item.product_id
                changed = True
            if not item.snapshot_product_name:
                item.snapshot_product_name = product.name
                changed = True
            if not item.snapshot_product_image:
                item.snapshot_product_image = _safe_product_image(product)
                changed = True

            if changed:
                to_update.append(item)

        if to_update:
            item_model.objects.bulk_update(
                to_update,
                ['snapshot_product_id', 'snapshot_product_name', 'snapshot_product_image'],
                batch_size=500,
            )


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0010_add_invoice_carrier_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='takeoutorderitem',
            name='snapshot_product_id',
            field=models.PositiveIntegerField(blank=True, db_index=True, null=True, verbose_name='商品快照ID'),
        ),
        migrations.AddField(
            model_name='takeoutorderitem',
            name='snapshot_product_image',
            field=models.TextField(blank=True, default='', verbose_name='商品快照圖片'),
        ),
        migrations.AddField(
            model_name='takeoutorderitem',
            name='snapshot_product_name',
            field=models.CharField(blank=True, default='', max_length=255, verbose_name='商品快照名稱'),
        ),
        migrations.AddField(
            model_name='dineinorderitem',
            name='snapshot_product_id',
            field=models.PositiveIntegerField(blank=True, db_index=True, null=True, verbose_name='商品快照ID'),
        ),
        migrations.AddField(
            model_name='dineinorderitem',
            name='snapshot_product_image',
            field=models.TextField(blank=True, default='', verbose_name='商品快照圖片'),
        ),
        migrations.AddField(
            model_name='dineinorderitem',
            name='snapshot_product_name',
            field=models.CharField(blank=True, default='', max_length=255, verbose_name='商品快照名稱'),
        ),
        migrations.RunPython(backfill_order_item_snapshots, reverse_noop),
        migrations.AlterField(
            model_name='takeoutorderitem',
            name='product',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='takeout_order_items', to='products.product', verbose_name='商品'),
        ),
        migrations.AlterField(
            model_name='dineinorderitem',
            name='product',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='dinein_order_items', to='products.product', verbose_name='商品'),
        ),
    ]
