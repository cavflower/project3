from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('schedules', '0003_shift_period_type_and_request_period_type'),
    ]

    operations = [
        migrations.AlterField(
            model_name='employeeschedulerequest',
            name='shift_type',
            field=models.CharField(
                choices=[
                    ('full_day', '整天'),
                    ('midnight', '凌晨'),
                    ('morning', '早上'),
                    ('afternoon', '下午'),
                    ('evening', '晚上'),
                ],
                default='full_day',
                max_length=20,
                verbose_name='時段類型',
            ),
        ),
    ]
