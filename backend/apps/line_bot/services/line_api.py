import os
import json
import requests
from typing import List, Dict, Optional


class LineMessagingAPI:
    """
    LINE Messaging API 服務類別
    支援多店家配置
    """
    
    def __init__(self, config=None):
        """
        初始化 LINE API 服務
        
        Args:
            config: StoreLineBotConfig 實例（可選）
        """
        if config:
            # 使用店家配置
            self.channel_access_token = config.line_channel_access_token
            self.channel_secret = config.line_channel_secret
        else:
            # 使用全域配置（向後兼容）
            self.channel_access_token = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')
            self.channel_secret = os.getenv('LINE_CHANNEL_SECRET')
        
        self.api_base_url = 'https://api.line.me/v2/bot'
        
    def _get_headers(self) -> Dict[str, str]:
        """取得 API 請求標頭"""
        return {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.channel_access_token}'
        }
    
    def reply_message(self, reply_token: str, messages: List[Dict]) -> bool:
        """
        回覆訊息
        
        Args:
            reply_token: LINE 提供的 reply token
            messages: 訊息列表（最多 5 則）
            
        Returns:
            bool: 是否成功發送
        """
        url = f'{self.api_base_url}/message/reply'
        
        payload = {
            'replyToken': reply_token,
            'messages': messages
        }
        
        try:
            response = requests.post(
                url,
                headers=self._get_headers(),
                data=json.dumps(payload)
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Reply message error: {e}")
            return False
    
    def push_message(self, to: str, messages: List[Dict]) -> bool:
        """
        主動推送訊息
        
        Args:
            to: 接收者的 LINE User ID
            messages: 訊息列表（最多 5 則）
            
        Returns:
            bool: 是否成功發送
        """
        url = f'{self.api_base_url}/message/push'
        
        payload = {
            'to': to,
            'messages': messages
        }
        
        try:
            print(f"[LINE API] Sending push to {to}, token: {self.channel_access_token[:20]}...")
            response = requests.post(
                url,
                headers=self._get_headers(),
                data=json.dumps(payload)
            )
            if response.status_code != 200:
                print(f"[LINE API] Push failed: status={response.status_code}, response={response.text}")
            else:
                print(f"[LINE API] Push success to {to}")
            return response.status_code == 200
        except Exception as e:
            print(f"Push message error: {e}")
            return False
    
    def multicast_message(self, to: List[str], messages: List[Dict]) -> Dict:
        """
        群發訊息（最多 500 人）
        
        Args:
            to: 接收者的 LINE User ID 列表
            messages: 訊息列表
            
        Returns:
            dict: 發送結果
        """
        url = f'{self.api_base_url}/message/multicast'
        
        payload = {
            'to': to,
            'messages': messages
        }
        
        try:
            response = requests.post(
                url,
                headers=self._get_headers(),
                data=json.dumps(payload)
            )
            return {
                'success': response.status_code == 200,
                'status_code': response.status_code,
                'response': response.json() if response.status_code == 200 else None
            }
        except Exception as e:
            print(f"Multicast message error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def broadcast_message(self, messages: List[Dict]) -> bool:
        """
        廣播訊息（發送給所有好友）
        
        Args:
            messages: 訊息列表
            
        Returns:
            bool: 是否成功發送
        """
        url = f'{self.api_base_url}/message/broadcast'
        
        payload = {
            'messages': messages
        }
        
        try:
            response = requests.post(
                url,
                headers=self._get_headers(),
                data=json.dumps(payload)
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Broadcast message error: {e}")
            return False
    
    def get_profile(self, user_id: str) -> Optional[Dict]:
        """
        取得用戶資料
        
        Args:
            user_id: LINE User ID
            
        Returns:
            dict: 用戶資料
        """
        url = f'{self.api_base_url}/profile/{user_id}'
        
        try:
            response = requests.get(url, headers=self._get_headers())
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            print(f"Get profile error: {e}")
            return None
    
    @staticmethod
    def create_text_message(text: str) -> Dict:
        """建立文字訊息"""
        return {
            'type': 'text',
            'text': text
        }
    
    @staticmethod
    def create_image_message(original_url: str, preview_url: str = None) -> Dict:
        """建立圖片訊息"""
        return {
            'type': 'image',
            'originalContentUrl': original_url,
            'previewImageUrl': preview_url or original_url
        }
    
    @staticmethod
    def create_flex_message(alt_text: str, contents: Dict) -> Dict:
        """建立 Flex Message（複雜排版訊息）"""
        return {
            'type': 'flex',
            'altText': alt_text,
            'contents': contents
        }
    
    @staticmethod
    def create_template_buttons(alt_text: str, title: str, text: str, actions: List[Dict]) -> Dict:
        """建立按鈕模板訊息"""
        return {
            'type': 'template',
            'altText': alt_text,
            'template': {
                'type': 'buttons',
                'title': title,
                'text': text,
                'actions': actions
            }
        }
