from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0001_initial'),
        ('products', '0011_specification_groups'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProductIngredient',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity_used', models.DecimalField(decimal_places=2, help_text='每售出 1 份商品會扣除的原物料數量', max_digits=10, verbose_name='每份使用量')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='建立時間')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新時間')),
                ('ingredient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='product_links', to='inventory.ingredient', verbose_name='原物料')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ingredient_links', to='products.product', verbose_name='商品')),
            ],
            options={
                'verbose_name': '商品配方',
                'verbose_name_plural': '商品配方',
                'db_table': 'product_ingredients',
                'ordering': ['product_id', 'ingredient_id'],
                'unique_together': {('product', 'ingredient')},
            },
        ),
    ]
