from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('schedules', '0009_employee_request_actual_schedule_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='employeeschedulerequest',
            name='actual_slot_actual_end_times',
            field=models.JSONField(blank=True, default=dict, verbose_name='實際班表時段實際下班時間'),
        ),
        migrations.AddField(
            model_name='employeeschedulerequest',
            name='actual_slot_off_duty_status',
            field=models.JSONField(blank=True, default=dict, verbose_name='實際班表時段下班狀況'),
        ),
    ]
