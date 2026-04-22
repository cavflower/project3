import os
import sys

from django.apps import AppConfig


class IntelligenceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.intelligence'
    verbose_name = '智慧推薦'

    def ready(self):
        # 只在 runserver 主程序啟動時啟用排程，避免重複推播。
        is_runserver = any(arg in ('runserver', 'runserver_plus') for arg in sys.argv)
        if not is_runserver:
            return

        if os.environ.get('RUN_MAIN') != 'true':
            return

        from .scheduler import start_recommendation_scheduler

        start_recommendation_scheduler()
