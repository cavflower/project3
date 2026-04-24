from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('loyalty', '0003_platformcoupon_userplatformcoupon'),
        ('line_bot', '0012_rename_store_user__store_i_f8b43a_idx_store_user__store_i_c32cf8_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='broadcastmessage',
            name='coupon',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='merchant_broadcasts',
                to='loyalty.platformcoupon',
                verbose_name='優惠券',
            ),
        ),
    ]
