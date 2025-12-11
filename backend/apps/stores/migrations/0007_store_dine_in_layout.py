from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('stores', '0006_alter_store_tags_allow_null'),
    ]

    operations = [
        migrations.AddField(
            model_name='store',
            name='dine_in_layout',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Configuration data for dine-in tables (floor plan).',
                verbose_name='內用座位配置',
            ),
        ),
    ]
