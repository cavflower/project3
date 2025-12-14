import os
import requests
from typing import List, Dict, Optional
from django.conf import settings
from apps.line_bot.models import StoreFAQ, ConversationLog


class FAQMatcher:
    """
    FAQ 匹配服務
    使用關鍵字匹配找到最適合的 FAQ
    """
    
    @staticmethod
    def find_best_match(store_id: int, user_message: str) -> Optional[StoreFAQ]:
        """
        尋找最佳匹配的 FAQ
        
        Args:
            store_id: 店家 ID
            user_message: 用戶訊息
            
        Returns:
            StoreFAQ: 最佳匹配的 FAQ，若無則返回 None
        """
        # 取得該店家所有啟用的 FAQ
        faqs = StoreFAQ.objects.filter(
            store_id=store_id,
            is_active=True
        ).order_by('-priority')
        
        user_message_lower = user_message.lower()
        best_match = None
        max_match_count = 0
        
        for faq in faqs:
            # 計算匹配到的關鍵字數量
            match_count = sum(
                1 for keyword in faq.keywords
                if keyword.lower() in user_message_lower
            )
            
            # 如果問題本身也包含在用戶訊息中，額外加分
            if faq.question.lower() in user_message_lower:
                match_count += 2
            
            if match_count > max_match_count:
                max_match_count = match_count
                best_match = faq
        
        # 如果至少匹配到一個關鍵字才返回
        if max_match_count > 0 and best_match:
            # 增加使用次數
            best_match.usage_count += 1
            best_match.save(update_fields=['usage_count'])
            return best_match
        
        return None


class AIReplyService:
    """
    AI 智能回覆服務
    支援 Google Gemini 和 OpenAI GPT
    """
    
    def __init__(self, config):
        """
        初始化 AI 服務
        
        Args:
            config: StoreLineBotConfig 實例
        """
        self.config = config
        self.api_key = config.ai_api_key
        self.model = config.ai_model
        self.provider = config.ai_provider
        self.temperature = config.ai_temperature
        self.max_tokens = config.ai_max_tokens
    
    def generate_reply(
        self,
        user_message: str,
        store_info: Dict,
        conversation_history: List[Dict] = None
    ) -> str:
        """
        使用 AI 生成回覆
        
        Args:
            user_message: 用戶訊息
            store_info: 店家資訊
            conversation_history: 對話歷史（可選）
            
        Returns:
            str: AI 生成的回覆
        """
        if self.provider == 'gemini':
            return self._generate_gemini_reply(user_message, store_info, conversation_history)
        elif self.provider == 'openai':
            return self._generate_openai_reply(user_message, store_info, conversation_history)
        else:
            return "抱歉，AI 服務暫時無法使用。"
    
    def _generate_gemini_reply(
        self,
        user_message: str,
        store_info: Dict,
        conversation_history: List[Dict] = None
    ) -> str:
        """使用 Google Gemini 生成回覆"""
        try:
            # 建立系統提示詞
            system_prompt = self._create_system_prompt(store_info)
            
            # 準備對話內容
            full_prompt = f"{system_prompt}\n\n"
            
            # 加入對話歷史（最多 3 則，減少 token 用量）
            if conversation_history and self.config.enable_conversation_history:
                for msg in conversation_history[-3:]:  # 從 5 則改為 3 則
                    role = "顧客" if msg.get("role") == "user" else "助手"
                    full_prompt += f"{role}: {msg.get('content', '')}\n"
            
            # 加入當前問題
            full_prompt += f"顧客: {user_message}\n助手: "
            
            # 呼叫 Gemini API
            # 處理模型名稱：確保格式正確
            model_name = self.model
            # 如果模型名稱不包含 'models/' 前綴，則添加
            if not model_name.startswith('models/'):
                # 將舊版本映射到新版本（使用 2.5 系列，配額更充裕）
                model_mapping = {
                    'gemini-2.5-flash': 'models/gemini-2.5-flash',
                    'gemini-2.5-pro': 'models/gemini-2.5-pro',
                    'gemini-pro': 'models/gemini-2.5-pro',
                }
                model_name = model_mapping.get(model_name, f'models/{model_name}')
            
            url = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent?key={self.api_key}"
            
            headers = {
                'Content-Type': 'application/json'
            }
            
            payload = {
                "contents": [{
                    "parts": [{
                        "text": full_prompt
                    }]
                }],
                "generationConfig": {
                    "temperature": self.temperature,
                    "maxOutputTokens": self.max_tokens,
                }
            }
            
            response = requests.post(url, headers=headers, json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if 'candidates' in data and len(data['candidates']) > 0:
                    reply = data['candidates'][0]['content']['parts'][0]['text']
                    return reply.strip()
            
            print(f"Gemini API error: {response.status_code} - {response.text}")
            return "抱歉，我現在無法回答這個問題。請稍後再試，或直接聯繫店家。"
            
        except Exception as e:
            print(f"Gemini reply error: {e}")
            return "抱歉，我現在無法回答這個問題。請稍後再試，或直接聯繫店家。"
    
    def _generate_openai_reply(
        self,
        user_message: str,
        store_info: Dict,
        conversation_history: List[Dict] = None
    ) -> str:
        """使用 OpenAI GPT 生成回覆"""
        try:
            import openai
            openai.api_key = self.api_key
            
            # 建立系統提示詞
            system_prompt = self._create_system_prompt(store_info)
            
            # 建立對話訊息
            messages = [
                {"role": "system", "content": system_prompt}
            ]
            
            # 加入對話歷史（最多 5 則）
            if conversation_history and self.config.enable_conversation_history:
                for msg in conversation_history[-5:]:
                    messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", "")
                    })
            
            # 加入當前用戶訊息
            messages.append({
                "role": "user",
                "content": user_message
            })
            
            # 呼叫 OpenAI API
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )
            
            reply = response.choices[0].message.content.strip()
            return reply
            
        except Exception as e:
            print(f"OpenAI reply error: {e}")
            return "抱歉，我現在無法回答這個問題。請稍後再試，或直接聯繫店家。"
    
    def _create_system_prompt(self, store_info: Dict) -> str:
        """
        建立系統提示詞
        
        Args:
            store_info: 店家資訊
            
        Returns:
            str: 系統提示詞
        """
        # 如果店家有自訂提示詞，優先使用
        if self.config.custom_system_prompt:
            return self.config.custom_system_prompt
        
        # 簡化版提示詞，減少 token 用量
        prompt = f"""你是 {store_info.get('name', '餐廳')} 的智能客服。

基本資訊：
- 類型：{store_info.get('cuisine_type', '未提供')}
- 地址：{store_info.get('address', '未提供')}
- 電話：{store_info.get('phone', '未提供')}
- 營業時間：{store_info.get('opening_hours', '未提供')}

任務：友善回答問題，保持簡潔，使用繁體中文。不確定時建議聯繫店家。"""
        return prompt


class MessageHandler:
    """
    訊息處理器
    整合 FAQ 匹配和 AI 回覆
    """
    
    def __init__(self, store_config):
        """
        初始化訊息處理器
        
        Args:
            store_config: StoreLineBotConfig 實例
        """
        self.config = store_config
        self.faq_matcher = FAQMatcher()
        if store_config.enable_ai_reply and store_config.has_ai_config():
            self.ai_service = AIReplyService(store_config)
        else:
            self.ai_service = None
    
    def handle_text_message(
        self,
        line_user_id: str,
        message: str,
        store_id: int,
        store_info: Dict
    ) -> Dict:
        """
        處理文字訊息
        
        Args:
            line_user_id: LINE User ID
            message: 用戶訊息
            store_id: 店家 ID
            store_info: 店家資訊
            
        Returns:
            dict: 包含回覆內容和相關資訊
        """
        # 先嘗試 FAQ 匹配
        matched_faq = self.faq_matcher.find_best_match(store_id, message)
        
        if matched_faq:
            # 有匹配的 FAQ
            return {
                'reply': matched_faq.answer,
                'used_ai': False,
                'matched_faq_id': matched_faq.id,
                'ai_model': None
            }
        else:
            # 使用 AI 生成回覆（如果已啟用）
            if self.ai_service:
                # 取得最近的對話歷史
                recent_logs = ConversationLog.objects.filter(
                    line_user_id=line_user_id,
                    store_id=store_id
                ).order_by('-created_at')[:10]
                
                conversation_history = [
                    {
                        "role": "assistant" if log.sender_type == "bot" else "user",
                        "content": log.message_content
                    }
                    for log in reversed(recent_logs)
                ]
                
                ai_reply = self.ai_service.generate_reply(
                    user_message=message,
                    store_info=store_info,
                    conversation_history=conversation_history
                )
                
                return {
                    'reply': ai_reply,
                    'used_ai': True,
                    'matched_faq_id': None,
                    'ai_model': self.config.ai_model
                }
            else:
                # AI 未啟用，返回預設訊息
                return {
                    'reply': '抱歉，我無法回答這個問題。請直接聯繫店家，謝謝！',
                    'used_ai': False,
                    'matched_faq_id': None,
                    'ai_model': None
                }
    
    def get_store_context_menu(self, store_info: Dict) -> str:
        """
        生成店家快捷選單文字
        
        Args:
            store_info: 店家資訊
            
        Returns:
            str: 快捷選單文字
        """
        menu_text = f"""歡迎來到 {store_info.get('name', '本餐廳')} 👋

您可以詢問我：
📍 餐廳位置與交通
⏰ 營業時間
🍽️ 推薦餐點
💰 優惠活動
📅 訂位資訊
📦 外帶服務

請直接輸入您的問題，我會盡快為您解答！"""
        
        return menu_text
