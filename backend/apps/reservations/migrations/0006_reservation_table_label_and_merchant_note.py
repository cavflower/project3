from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reservations', '0005_delete_storereservationsettings'),
    ]

    operations = [
        migrations.AddField(
            model_name='reservation',
            name='merchant_note',
            field=models.TextField(
                blank=True,
                default='',
                help_text='商家提供給顧客的訂位備註',
                verbose_name='商家備註',
            ),
        ),
        migrations.AddField(
            model_name='reservation',
            name='table_label',
            field=models.CharField(
                blank=True,
                default='',
                help_text='商家為此訂位指定的內用桌號',
                max_length=100,
                verbose_name='指定桌號',
            ),
        ),
    ]
