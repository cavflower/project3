from django.db import migrations, models
import django.db.models.deletion


def _safe_image_url(surplus_food):
    image = getattr(surplus_food, 'image', None)
    if not image:
        return ''
    try:
        return image.url
    except Exception:
        return ''


def _build_snapshot_specifications(surplus_food):
    specs = []

    if hasattr(surplus_food, 'get_condition_display'):
        condition_display = surplus_food.get_condition_display()
    else:
        condition_display = getattr(surplus_food, 'condition', '')
    if condition_display:
        specs.append({'label': '商品狀況', 'value': condition_display})

    if hasattr(surplus_food, 'get_dining_option_display'):
        dining_display = surplus_food.get_dining_option_display()
    else:
        dining_display = getattr(surplus_food, 'dining_option', '')
    if dining_display:
        specs.append({'label': '供應方式', 'value': dining_display})

    slot = getattr(surplus_food, 'time_slot', None)
    if slot:
        start_time = slot.start_time.strftime('%H:%M') if getattr(slot, 'start_time', None) else ''
        end_time = slot.end_time.strftime('%H:%M') if getattr(slot, 'end_time', None) else ''
        time_range = f"{start_time}-{end_time}" if start_time and end_time else ''
        slot_value = f"{slot.name} ({time_range})" if time_range else slot.name
        specs.append({'label': '可取餐時段', 'value': slot_value})

    return specs


def backfill_surplus_order_item_snapshots(apps, schema_editor):
    item_model = apps.get_model('surplus_food', 'SurplusFoodOrderItem')
    to_update = []

    queryset = item_model.objects.select_related('surplus_food', 'surplus_food__time_slot').filter(
        surplus_food_id__isnull=False
    )

    for item in queryset.iterator():
        surplus_food = item.surplus_food
        if surplus_food is None:
            continue

        changed = False

        if item.snapshot_surplus_food_id is None:
            item.snapshot_surplus_food_id = item.surplus_food_id
            changed = True

        if not item.snapshot_surplus_food_name:
            item.snapshot_surplus_food_name = surplus_food.title
            changed = True

        if not item.snapshot_surplus_food_image:
            item.snapshot_surplus_food_image = _safe_image_url(surplus_food)
            changed = True

        if not item.snapshot_specifications:
            item.snapshot_specifications = _build_snapshot_specifications(surplus_food)
            changed = True

        if changed:
            to_update.append(item)

    if to_update:
        item_model.objects.bulk_update(
            to_update,
            [
                'snapshot_surplus_food_id',
                'snapshot_surplus_food_name',
                'snapshot_surplus_food_image',
                'snapshot_specifications',
            ],
            batch_size=500,
        )


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('surplus_food', '0017_add_max_quantity_per_order'),
    ]

    operations = [
        migrations.AddField(
            model_name='surplusfoodorderitem',
            name='snapshot_specifications',
            field=models.JSONField(blank=True, default=list, verbose_name='品項規格快照'),
        ),
        migrations.AddField(
            model_name='surplusfoodorderitem',
            name='snapshot_surplus_food_id',
            field=models.PositiveIntegerField(blank=True, db_index=True, null=True, verbose_name='惜福品快照ID'),
        ),
        migrations.AddField(
            model_name='surplusfoodorderitem',
            name='snapshot_surplus_food_image',
            field=models.TextField(blank=True, default='', verbose_name='惜福品快照圖片'),
        ),
        migrations.AddField(
            model_name='surplusfoodorderitem',
            name='snapshot_surplus_food_name',
            field=models.CharField(blank=True, default='', max_length=255, verbose_name='惜福品快照名稱'),
        ),
        migrations.RunPython(backfill_surplus_order_item_snapshots, reverse_noop),
        migrations.AlterField(
            model_name='surplusfoodorderitem',
            name='surplus_food',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='order_items', to='surplus_food.surplusfood', verbose_name='惜福食品'),
        ),
    ]
