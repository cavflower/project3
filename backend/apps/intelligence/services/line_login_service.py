"""
LINE Login 服務
處理 LINE Login OAuth 2.0 流程和用戶綁定
"""
import logging
import requests
import secrets
from urllib.parse import urlencode
from django.conf import settings

from apps.intelligence.models import PlatformSettings
from apps.line_bot.models import LineUserBinding

logger = logging.getLogger(__name__)


class LineLoginService:
    """
    LINE Login OAuth 2.0 服務
    """
    
    AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize'
    TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token'
    PROFILE_URL = 'https://api.line.me/v2/profile'
    REVOKE_URL = 'https://api.line.me/oauth2/v2.1/revoke'
    
    def __init__(self):
        platform_settings = PlatformSettings.get_settings()
        self.channel_id = platform_settings.line_login_channel_id
        self.channel_secret = platform_settings.line_login_channel_secret
    
    def get_authorization_url(self, redirect_uri: str, state: str = None) -> str:
        """
        產生 LINE Login 授權 URL
        
        Args:
            redirect_uri: 授權完成後的回調 URL
            state: 防止 CSRF 的隨機字串
            
        Returns:
            str: LINE Login 授權頁面 URL
        """
        if not state:
            state = secrets.token_urlsafe(32)
        
        params = {
            'response_type': 'code',
            'client_id': self.channel_id,
            'redirect_uri': redirect_uri,
            'state': state,
            'scope': 'profile openid',
        }
        
        return f"{self.AUTHORIZE_URL}?{urlencode(params)}"
    
    def exchange_code_for_token(self, code: str, redirect_uri: str) -> dict:
        """
        用授權碼換取 access token
        
        Args:
            code: LINE 回傳的授權碼
            redirect_uri: 與授權請求相同的回調 URL
            
        Returns:
            dict: 包含 access_token, id_token 等
        """
        data = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': redirect_uri,
            'client_id': self.channel_id,
            'client_secret': self.channel_secret,
        }
        
        response = requests.post(self.TOKEN_URL, data=data, timeout=10)
        response.raise_for_status()
        
        return response.json()
    
    def get_user_profile(self, access_token: str) -> dict:
        """
        取得 LINE 用戶資料
        
        Args:
            access_token: LINE access token
            
        Returns:
            dict: LINE 用戶資料（userId, displayName, pictureUrl）
        """
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        
        response = requests.get(self.PROFILE_URL, headers=headers, timeout=10)
        response.raise_for_status()
        
        return response.json()
    
    def bind_user(self, user, line_user_id: str, display_name: str = '', picture_url: str = '') -> LineUserBinding:
        """
        將 LINE 用戶綁定到平台用戶
        
        Args:
            user: Django User 實例
            line_user_id: LINE User ID
            display_name: LINE 顯示名稱
            picture_url: LINE 頭像 URL
            
        Returns:
            LineUserBinding: 綁定記錄
        """
        # 檢查是否已有其他用戶綁定此 LINE ID
        existing = LineUserBinding.objects.filter(line_user_id=line_user_id).first()
        if existing and existing.user_id != user.id:
            raise ValueError('此 LINE 帳號已被其他用戶綁定')
        
        # 建立或更新綁定
        binding, created = LineUserBinding.objects.update_or_create(
            user=user,
            defaults={
                'line_user_id': line_user_id,
                'display_name': display_name,
                'picture_url': picture_url,
                'is_active': True,
            }
        )
        
        logger.info(f"[LINE Login] User {user.id} bound to LINE: {line_user_id}")
        return binding
    
    def unbind_user(self, user) -> bool:
        """
        解除用戶的 LINE 綁定
        
        Args:
            user: Django User 實例
            
        Returns:
            bool: 是否成功解綁
        """
        try:
            binding = LineUserBinding.objects.get(user=user)
            binding.delete()
            logger.info(f"[LINE Login] User {user.id} unbound from LINE")
            return True
        except LineUserBinding.DoesNotExist:
            return False
    
    def get_binding_status(self, user) -> dict:
        """
        取得用戶的 LINE 綁定狀態
        
        Args:
            user: Django User 實例
            
        Returns:
            dict: 綁定狀態資訊
        """
        try:
            binding = LineUserBinding.objects.get(user=user)
            return {
                'is_bound': True,
                'line_user_id': binding.line_user_id,
                'display_name': binding.display_name,
                'picture_url': binding.picture_url,
                'bound_at': binding.created_at.isoformat(),
            }
        except LineUserBinding.DoesNotExist:
            return {
                'is_bound': False,
            }
    
    def revoke_token(self, access_token: str) -> bool:
        """
        撤銷 LINE access token
        
        Args:
            access_token: 要撤銷的 token
            
        Returns:
            bool: 是否成功
        """
        try:
            data = {
                'access_token': access_token,
                'client_id': self.channel_id,
                'client_secret': self.channel_secret,
            }
            response = requests.post(self.REVOKE_URL, data=data, timeout=10)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"[LINE Login] Revoke token failed: {e}")
            return False
