from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('schedules', '0007_staff_employee_user_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='staff',
            name='nickname',
            field=models.CharField(blank=True, default='', max_length=100, verbose_name='暱稱'),
        ),
    ]
