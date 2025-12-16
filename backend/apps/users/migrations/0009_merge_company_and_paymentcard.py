# Generated manually to merge 0009_company_user_company_tax_id and 0009_paymentcard
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0008_merchant_discount_reason_and_more'),
    ]

    replaces = [
        ('users', '0009_company_user_company_tax_id'),
        ('users', '0009_paymentcard'),
    ]

    operations = [
        # From 0009_company_user_company_tax_id
        migrations.CreateModel(
            name='Company',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tax_id', models.CharField(help_text='公司統一編號', max_length=8, unique=True, verbose_name='公司統編')),
                ('name', models.CharField(help_text='公司名稱', max_length=255, verbose_name='公司名稱')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': '公司',
                'verbose_name_plural': '公司',
                'ordering': ['name'],
            },
        ),
        migrations.AddField(
            model_name='user',
            name='company_tax_id',
            field=models.CharField(blank=True, help_text='選填，如果填寫且對應到某間公司，則代表是該公司員工', max_length=8, null=True, verbose_name='公司統編'),
        ),
        
        # From 0009_paymentcard
        migrations.CreateModel(
            name='PaymentCard',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('card_holder_name', models.CharField(max_length=100, verbose_name='持卡人姓名')),
                ('card_number_encrypted', models.BinaryField(verbose_name='加密的卡號')),
                ('card_last_four', models.CharField(max_length=4, verbose_name='卡號後四碼')),
                ('expiry_month', models.CharField(max_length=2, verbose_name='到期月份')),
                ('expiry_year', models.CharField(max_length=4, verbose_name='到期年份')),
                ('cvv_encrypted', models.BinaryField(verbose_name='加密的CVV')),
                ('is_default', models.BooleanField(default=False, verbose_name='是否為預設卡片')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='建立時間')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新時間')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payment_cards', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': '信用卡',
                'verbose_name_plural': '信用卡',
                'ordering': ['-is_default', '-created_at'],
            },
        ),
    ]
