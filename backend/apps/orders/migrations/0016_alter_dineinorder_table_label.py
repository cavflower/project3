from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0015_dineinorder_orders_dine_store_i_90ab3f_idx_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='dineinorder',
            name='table_label',
            field=models.CharField(max_length=100, verbose_name='桌號'),
        ),
    ]
