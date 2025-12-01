# Generated manually

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('stores', '0006_alter_store_tags_allow_null'),
    ]

    operations = [
        migrations.CreateModel(
            name='Staff',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='姓名')),
                ('role', models.CharField(max_length=100, verbose_name='職務')),
                ('status', models.CharField(blank=True, help_text='例如：本週可排、可支援午班等', max_length=200, verbose_name='備註／出勤狀態')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='建立時間')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新時間')),
                ('store', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='staff_members', to='stores.store', verbose_name='所屬店家')),
            ],
            options={
                'verbose_name': '員工',
                'verbose_name_plural': '員工',
                'db_table': 'staff',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Shift',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(verbose_name='日期')),
                ('shift_type', models.CharField(choices=[('morning', '早班'), ('noon', '午班'), ('evening', '晚班')], default='morning', max_length=20, verbose_name='時段類型')),
                ('role', models.CharField(max_length=100, verbose_name='需求職務')),
                ('staff_needed', models.PositiveIntegerField(default=1, verbose_name='需求人數')),
                ('start_hour', models.PositiveIntegerField(default=8, verbose_name='開始小時')),
                ('start_minute', models.PositiveIntegerField(default=0, verbose_name='開始分鐘')),
                ('end_hour', models.PositiveIntegerField(default=12, verbose_name='結束小時')),
                ('end_minute', models.PositiveIntegerField(default=0, verbose_name='結束分鐘')),
                ('status', models.CharField(choices=[('ready', '準備就緒'), ('ongoing', '進行中'), ('pending', '待排班')], default='pending', max_length=20, verbose_name='狀態')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='建立時間')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新時間')),
                ('assigned_staff', models.ManyToManyField(blank=True, related_name='assigned_shifts', to='schedules.staff', verbose_name='已指派員工')),
                ('store', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shifts', to='stores.store', verbose_name='所屬店家')),
            ],
            options={
                'verbose_name': '排班時段',
                'verbose_name_plural': '排班時段',
                'db_table': 'shifts',
                'ordering': ['date', 'start_hour', 'start_minute'],
            },
        ),
    ]

