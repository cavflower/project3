from .base import *
import os

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = [
    '127.0.0.1',
    'localhost',
    '.ngrok-free.app',  # 允許所有 ngrok 子域名
    '.ngrok.io',         # 舊版 ngrok 域名
    'unexpired-bari-unteamed.ngrok-free.dev',  # 您當前的 ngrok 網址
]

# Development SQL observability
ENABLE_QUERY_DEBUG = env_bool('ENABLE_QUERY_DEBUG', True)
SQL_SLOW_QUERY_THRESHOLD_MS = int(os.getenv('SQL_SLOW_QUERY_THRESHOLD_MS', '120'))
LOG_SLOW_SQL_TEXT = env_bool('LOG_SLOW_SQL_TEXT', True)
MAX_LOGGED_SLOW_QUERIES = int(os.getenv('MAX_LOGGED_SLOW_QUERIES', '8'))

if ENABLE_QUERY_DEBUG and 'catering_platform_api.middleware.QueryDebugMiddleware' not in MIDDLEWARE:
    MIDDLEWARE.insert(0, 'catering_platform_api.middleware.QueryDebugMiddleware')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '[{levelname}] {asctime} {name}: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'standard',
        },
    },
    'loggers': {
        'performance.sql': {
            'handlers': ['console'],
            'level': os.getenv('PERFORMANCE_SQL_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
    },
}

# Add any other development-specific settings here.
