from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('stores', '0001_initial'),
        ('schedules', '0004_employee_request_available_shift_default'),
    ]

    operations = [
        migrations.CreateModel(
            name='JobRole',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='職務名稱')),
                ('description', models.CharField(blank=True, default='', max_length=255, verbose_name='職務說明')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='建立時間')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新時間')),
                ('store', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='job_roles', to='stores.store', verbose_name='所屬店家')),
            ],
            options={
                'verbose_name': '職務',
                'verbose_name_plural': '職務',
                'db_table': 'job_roles',
                'ordering': ['name', '-created_at'],
                'unique_together': {('store', 'name')},
            },
        ),
        migrations.AddField(
            model_name='employeeschedulerequest',
            name='assigned_shift_types',
            field=models.JSONField(blank=True, default=list, verbose_name='店家安排時段'),
        ),
        migrations.AddField(
            model_name='employeeschedulerequest',
            name='assignment_status',
            field=models.CharField(choices=[('pending', '待安排'), ('scheduled', '已排班'), ('rejected', '已排休')], default='pending', max_length=20, verbose_name='店家安排狀態'),
        ),
    ]
