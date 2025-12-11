from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('stores', '0006_alter_store_tags_allow_null'),
    ]

    operations = [
        migrations.CreateModel(
            name='PointRule',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, help_text='規則名稱，供商家管理用')),
                ('points_per_currency', models.DecimalField(decimal_places=4, max_digits=10, default=0)),
                ('min_spend', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('store', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='point_rules', to='stores.store')),
            ],
            options={
                'verbose_name': '點數規則',
                'verbose_name_plural': '點數規則',
            },
        ),
        migrations.CreateModel(
            name='MembershipLevel',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('threshold_points', models.IntegerField(default=0, help_text='需要的累積點數達到此門檻可成為此等級')),
                ('discount_percent', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('benefits', models.TextField(blank=True, default='')),
                ('rank', models.IntegerField(default=0)),
                ('active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('store', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='membership_levels', to='stores.store')),
            ],
            options={
                'verbose_name': '會員等級',
                'verbose_name_plural': '會員等級',
                'ordering': ['rank', '-threshold_points'],
            },
        ),
        migrations.CreateModel(
            name='RedemptionProduct',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, default='')),
                ('required_points', models.IntegerField(help_text='兌換此商品所需點數')),
                ('inventory', models.IntegerField(blank=True, null=True, help_text='存量（null 表示不限量）')),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('store', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='redemption_products', to='stores.store')),
            ],
            options={
                'verbose_name': '兌換商品',
                'verbose_name_plural': '兌換商品',
            },
        ),
    ]
