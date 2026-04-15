from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('schedules', '0006_employee_request_assigned_slot_roles'),
    ]

    operations = [
        migrations.AddField(
            model_name='staff',
            name='employee_user_id',
            field=models.PositiveIntegerField(blank=True, help_text='若此員工來自系統使用者，記錄其 User ID 以避免重複建立', null=True, verbose_name='對應員工帳號ID'),
        ),
    ]
