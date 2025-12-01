# Generated manually to fix migration dependencies
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('stores', '0001_initial'),
        ('products', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='TakeoutOrder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('customer_name', models.CharField(max_length=50)),
                ('customer_phone', models.CharField(max_length=20)),
                ('pickup_at', models.DateTimeField()),
                ('payment_method', models.CharField(choices=[('cash', '現金'), ('credit_card', '信用卡'), ('line_pay', 'LINE Pay')], max_length=20)),
                ('notes', models.TextField(blank=True)),
                ('pickup_number', models.CharField(max_length=10, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('store', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='order_takeout_orders', to='stores.store')),
            ],
        ),
        migrations.CreateModel(
            name='TakeoutOrderItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.PositiveIntegerField()),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='orders.takeoutorder')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='order_takeout_items', to='products.product')),
            ],
        ),
    ]
