from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = [
    '127.0.0.1',
    'localhost',
    '.ngrok-free.app',  # 允許所有 ngrok 子域名
    '.ngrok.io',         # 舊版 ngrok 域名
    'unexpired-bari-unteamed.ngrok-free.dev',  # 您當前的 ngrok 網址
]

# Add any other development-specific settings here.
