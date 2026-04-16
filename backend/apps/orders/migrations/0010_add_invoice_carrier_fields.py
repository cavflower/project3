from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0009_add_product_redemptions'),
    ]

    operations = [
        migrations.AddField(
            model_name='dineinorder',
            name='invoice_carrier',
            field=models.CharField(blank=True, default='', help_text='格式：/XXXXXXX', max_length=8, verbose_name='發票載具'),
        ),
        migrations.AddField(
            model_name='takeoutorder',
            name='invoice_carrier',
            field=models.CharField(blank=True, default='', help_text='格式：/XXXXXXX', max_length=8, verbose_name='發票載具'),
        ),
    ]
