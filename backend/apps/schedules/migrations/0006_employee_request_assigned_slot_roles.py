from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('schedules', '0005_jobrole_and_request_assignment_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='employeeschedulerequest',
            name='assigned_slot_roles',
            field=models.JSONField(blank=True, default=dict, verbose_name='店家安排時段職務'),
        ),
    ]
