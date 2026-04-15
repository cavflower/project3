from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('schedules', '0002_employeeschedulerequest'),
    ]

    operations = [
        migrations.AddField(
            model_name='shift',
            name='period_type',
            field=models.CharField(
                choices=[('day', '日'), ('week', '週'), ('month', '月')],
                default='day',
                max_length=10,
                verbose_name='排班方式',
            ),
        ),
        migrations.AddField(
            model_name='employeeschedulerequest',
            name='period_type',
            field=models.CharField(
                choices=[('day', '日'), ('week', '週'), ('month', '月')],
                default='day',
                max_length=10,
                verbose_name='可上班時間設定方式',
            ),
        ),
        migrations.AlterField(
            model_name='employeeschedulerequest',
            name='role',
            field=models.CharField(blank=True, max_length=100, null=True, verbose_name='職務'),
        ),
        migrations.AlterField(
            model_name='employeeschedulerequest',
            name='week_start_date',
            field=models.DateField(blank=True, help_text='該申請所屬的週（週一日期）', null=True, verbose_name='週起始日期'),
        ),
        migrations.AlterModelOptions(
            name='employeeschedulerequest',
            options={
                'db_table': 'employee_schedule_requests',
                'ordering': ['-date', 'period_type', 'shift_type'],
                'verbose_name': '員工排班申請',
                'verbose_name_plural': '員工排班申請',
            },
        ),
        migrations.AlterUniqueTogether(
            name='employeeschedulerequest',
            unique_together={('employee', 'store', 'date', 'period_type', 'shift_type')},
        ),
    ]
