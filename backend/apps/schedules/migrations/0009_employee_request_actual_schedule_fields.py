from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('schedules', '0008_staff_nickname'),
    ]

    operations = [
        migrations.AddField(
            model_name='employeeschedulerequest',
            name='actual_slot_work_times',
            field=models.JSONField(blank=True, default=dict, verbose_name='實際班表時段上下班時間'),
        ),
        migrations.AddField(
            model_name='employeeschedulerequest',
            name='actual_slot_attendance',
            field=models.JSONField(blank=True, default=dict, verbose_name='實際班表時段到班狀況'),
        ),
    ]
