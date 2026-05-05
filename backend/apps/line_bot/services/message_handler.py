import os
import re
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
    支援 Google Gemini、OpenAI GPT 和 Groq
    優先使用平台 AI 設定，若無則使用店家設定（保持向後相容）
    """
    
    def __init__(self, store_config=None):
        """
        初始化 AI 服務
        
        Args:
            store_config: StoreLineBotConfig 實例（可選，用於自訂系統提示詞）
        """
        self.store_config = store_config

        # Prompt / conversation limits must exist even when platform AI settings
        # are loaded successfully and __init__ returns early.
        self.max_prompt_chars = 3600
        self.max_history_messages = 2
        self.max_history_message_chars = 120
        self.max_output_tokens_cap = 450
        
        # 使用平台 AI 設定
        try:
            from apps.intelligence.models import PlatformSettings
            platform_settings = PlatformSettings.get_settings()
            
            if platform_settings.has_ai_config():
                # 使用平台設定
                self.api_key = platform_settings.ai_api_key
                self.provider = platform_settings.ai_provider
                self.model = platform_settings.ai_model
                self.temperature = platform_settings.ai_temperature
                self.max_tokens = platform_settings.ai_max_tokens
                self.using_platform_ai = True
                return
        except Exception as e:
            print(f"[AIReplyService] Error loading platform settings: {e}")
        
        # 平台未設定 AI，服務不可用
        self.api_key = None
        self.provider = None
        self.model = None
        self.temperature = 0.7
        self.max_tokens = 500
        self.using_platform_ai = False

        # Prompt / 回覆長度控制，避免上下文過長造成不穩定
        self.max_prompt_chars = 3600
        self.max_history_messages = 2
        self.max_history_message_chars = 120
        self.max_output_tokens_cap = 450

    @staticmethod
    def _truncate_text(text: str, max_chars: int) -> str:
        """裁切字串以控制 prompt 長度。"""
        if text is None:
            return ''
        text = str(text).strip()
        if len(text) <= max_chars:
            return text
        return f"{text[:max_chars]}..."

    @staticmethod
    def _format_opening_hours(opening_hours) -> str:
        """將 opening_hours 轉成穩定可讀字串。"""
        if not opening_hours:
            return '未提供'

        if isinstance(opening_hours, str):
            return opening_hours

        if isinstance(opening_hours, dict):
            day_alias = {
                'monday': '星期一',
                'tuesday': '星期二',
                'wednesday': '星期三',
                'thursday': '星期四',
                'friday': '星期五',
                'saturday': '星期六',
                'sunday': '星期日',
            }
            day_order = {
                'monday': 0,
                'tuesday': 1,
                'wednesday': 2,
                'thursday': 3,
                'friday': 4,
                'saturday': 5,
                'sunday': 6,
            }

            lines = []
            for day_key, value in sorted(opening_hours.items(), key=lambda item: day_order.get(item[0], 99)):
                label = day_alias.get(day_key, day_key)
                if isinstance(value, dict):
                    if value.get('is_closed') is True:
                        lines.append(f"{label}: 休息")
                        continue

                    open_time = value.get('open') or value.get('start') or value.get('open_time')
                    close_time = value.get('close') or value.get('end') or value.get('close_time')
                    if open_time and close_time:
                        lines.append(f"{label}: {open_time}-{close_time}")
                    else:
                        lines.append(f"{label}: {value}")
                else:
                    lines.append(f"{label}: {value}")

            if lines:
                return '\n'.join(lines)

        return str(opening_hours)

    @staticmethod
    def _format_reservation_info(reservation_info: Dict) -> str:
        """整理訂位資訊供固定回覆和 prompt 共用。"""
        if not isinstance(reservation_info, dict):
            return '未提供'

        enabled = reservation_info.get('enabled')
        if enabled is False:
            return '本店目前未開放訂位。'

        phone = reservation_info.get('contact_phone') or '未提供'
        fixed_holidays = reservation_info.get('fixed_holidays') or '未提供'
        slots = reservation_info.get('time_slots') or []

        slot_lines = []
        for slot in slots[:12]:
            day = slot.get('day', '未知')
            start = slot.get('start_time', '')
            end = slot.get('end_time', '')
            max_party = slot.get('max_party_size')
            time_range = f"{start}-{end}" if end else start
            if max_party:
                slot_lines.append(f"- {day} {time_range}（單筆最多 {max_party} 人）")
            else:
                slot_lines.append(f"- {day} {time_range}")

        if slot_lines:
            slots_text = '\n'.join(slot_lines)
        else:
            slots_text = '目前未設定固定訂位時段，請來電洽詢。'

        return f"開放訂位。訂位聯絡電話：{phone}\n固定休息日：{fixed_holidays}\n可預約時段：\n{slots_text}"

    @staticmethod
    def _format_fixed_holidays(store_info: Dict) -> str:
        """固定休息日優先從 opening_hours 的非營業日推導，避免依賴手填文字。"""
        opening_hours = store_info.get('opening_hours')
        day_alias = {
            'monday': '星期一',
            'tuesday': '星期二',
            'wednesday': '星期三',
            'thursday': '星期四',
            'friday': '星期五',
            'saturday': '星期六',
            'sunday': '星期日',
        }
        day_order = [
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
            'sunday',
        ]

        # 1) 由營業時間推導非營業日
        if isinstance(opening_hours, dict) and opening_hours:
            closed_days = []
            for day_key in day_order:
                value = opening_hours.get(day_key)
                if not isinstance(value, dict):
                    continue

                is_closed = value.get('is_closed') is True
                open_time = value.get('open') or value.get('start') or value.get('open_time')
                close_time = value.get('close') or value.get('end') or value.get('close_time')

                # 店家設定為休息，或未提供時段都視為非營業
                if is_closed or not (open_time and close_time):
                    closed_days.append(day_alias.get(day_key, day_key))

            if closed_days:
                return '、'.join(closed_days)

        # 2) 若營業時間無法推導，嘗試由訂位時段反推（有設定的日子視為營業）
        reservation = store_info.get('reservation') if isinstance(store_info.get('reservation'), dict) else {}
        slots = reservation.get('time_slots') if isinstance(reservation, dict) else []
        if isinstance(slots, list) and slots:
            open_days = {
                str(slot.get('day', '')).strip()
                for slot in slots
                if isinstance(slot, dict) and slot.get('day')
            }
            all_days_zh = [day_alias[day_key] for day_key in day_order]
            inferred_closed = [day for day in all_days_zh if day not in open_days]
            if inferred_closed:
                return '、'.join(inferred_closed)

        # 3) 最後才回退到原文字欄位
        return store_info.get('fixed_holidays') or reservation.get('fixed_holidays') or '未提供'

    def _get_effective_max_tokens(self) -> int:
        """限制單次輸出 token，避免過長與成本暴增。"""
        configured = self.max_tokens if isinstance(self.max_tokens, int) else 500
        configured = max(120, configured)
        return min(configured, self.max_output_tokens_cap)

    def _compact_history(self, conversation_history: Optional[List[Dict]]) -> List[Dict]:
        """壓縮對話歷史，避免 token 無限制成長。"""
        if not conversation_history:
            return []

        compacted = []
        for msg in conversation_history[-self.max_history_messages:]:
            compacted.append({
                'role': msg.get('role', 'user'),
                'content': self._truncate_text(msg.get('content', ''), self.max_history_message_chars)
            })
        return compacted
    
    def is_available(self):
        """檢查 AI 服務是否可用"""
        return bool(self.api_key)
    
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
        elif self.provider == 'groq':
            return self._generate_groq_reply(user_message, store_info, conversation_history)
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
            
            # 加入對話歷史（限制則數與單則長度，控制 token）
            enable_history = getattr(self.store_config, 'enable_conversation_history', True) if self.store_config else True
            if conversation_history and enable_history:
                for msg in self._compact_history(conversation_history):
                    role = "顧客" if msg.get("role") == "user" else "助手"
                    full_prompt += f"{role}: {msg.get('content', '')}\n"
            
            # 加入當前問題
            full_prompt += f"顧客: {user_message}\n助手: "

            # 最終 prompt 長度控制
            full_prompt = self._truncate_text(full_prompt, self.max_prompt_chars)
            
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
                    "maxOutputTokens": self._get_effective_max_tokens(),
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
            
            # 加入對話歷史（限制則數與單則長度，控制 token）
            enable_history = getattr(self.store_config, 'enable_conversation_history', True) if self.store_config else True
            if conversation_history and enable_history:
                for msg in self._compact_history(conversation_history):
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
                max_tokens=self._get_effective_max_tokens()
            )
            
            reply = response.choices[0].message.content.strip()
            return reply
            
        except Exception as e:
            print(f"OpenAI reply error: {e}")
            return "抱歉，我現在無法回答這個問題。請稍後再試，或直接聯繫店家。"
    
    def _generate_groq_reply(
        self,
        user_message: str,
        store_info: Dict,
        conversation_history: List[Dict] = None
    ) -> str:
        """使用 Groq 生成回覆"""
        try:
            from groq import Groq
            
            # 初始化 Groq 客戶端
            client = Groq(api_key=self.api_key)
            
            # 建立系統提示詞
            system_prompt = self._create_system_prompt(store_info)
            
            # 建立對話訊息
            messages = [
                {"role": "system", "content": system_prompt}
            ]
            
            # 加入對話歷史（限制則數與單則長度，控制 token）
            enable_history = getattr(self.store_config, 'enable_conversation_history', True) if self.store_config else True
            if conversation_history and enable_history:
                for msg in self._compact_history(conversation_history):
                    messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", "")
                    })
            
            # 加入當前用戶訊息
            messages.append({
                "role": "user",
                "content": user_message
            })
            
            # 呼叫 Groq API
            completion = client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self._get_effective_max_tokens(),
                top_p=1,
                stream=False,  # 使用非串流模式以簡化處理
                stop=None
            )
            
            reply = completion.choices[0].message.content.strip()
            return reply
            
        except Exception as e:
            print(f"Groq reply error: {e}")
            return "抱歉，我現在無法回答這個問題。請稍後再試，或直接聯繫店家。"
    
    def _create_system_prompt(self, store_info: Dict) -> str:
        """
        建立系統提示詞
        
        Args:
            store_info: 店家資訊（包含菜單資料）
            
        Returns:
            str: 系統提示詞
        """
        store_name = store_info.get('name', '餐廳')
        
        # 建立菜單文字
        menu_text = ""
        menu_data = store_info.get('menu', [])
        if menu_data:
            menu_lines = []
            for category_data in menu_data:
                category_name = category_data.get('category', '未分類')
                menu_lines.append(f"\n【{category_name}】")
                for product in category_data.get('products', []):
                    product_line = f"- {product['name']} ${product['price']}"
                    if product.get('description'):
                        product_line += f" ({self._truncate_text(product['description'], 60)})"
                    menu_lines.append(product_line)
                    # 加入規格資訊
                    if product.get('specifications'):
                        for spec in product['specifications'][:3]:
                            menu_lines.append(f"  └ {spec}")
            menu_text = "\n".join(menu_lines)

        fixed_holidays = self._format_fixed_holidays(store_info)
        opening_hours_text = self._format_opening_hours(store_info.get('opening_hours'))
        reservation_context = dict(store_info.get('reservation', {}) or {})
        reservation_context['fixed_holidays'] = fixed_holidays
        reservation_info_text = self._format_reservation_info(reservation_context)
        website = store_info.get('website') or '未提供'
        line_friend_url = store_info.get('line_friend_url') or '未提供'
        
        # 建立基本提示詞（包含菜單資料）
        base_prompt = f"""你是 {store_name} 的智能客服助手。

基本資訊：
- 餐廳類型：{store_info.get('cuisine_type', '未提供')}
- 地址：{store_info.get('address', '未提供')}
- 電話：{store_info.get('phone', '未提供')}
- 營業時間：\n{opening_hours_text}
- 餐廳介紹：{store_info.get('description', '未提供')}"""

        base_prompt += f"""
- 固定休息日：{fixed_holidays}
- 官方網站：{website}
- LINE 好友連結：{line_friend_url}

訂位資訊：
{reservation_info_text}"""

        # 如果有菜單資料，加入提示詞
        if menu_text:
            menu_text = self._truncate_text(menu_text, 1400)
            base_prompt += f"""

菜單資訊：{menu_text}"""
        
        base_prompt += """

任務指示：
1. 以親切友善的態度回答顧客問題
2. 使用繁體中文回覆
3. 保持回覆簡潔明瞭
4. 當顧客詢問菜單時，根據上方菜單資訊回答
5. 可以推薦餐點並說明價格和規格
6. 如果問題超出你的知識範圍，建議顧客直接聯繫店家
7. 對於電話、營業時間、訂位規則，僅能引用上述資料，不可自行猜測或改寫"""

        # 如果店家有自訂提示詞，附加在後面
        if self.store_config and self.store_config.custom_system_prompt:
            base_prompt += f"""

店家額外指示：
        {self._truncate_text(self.store_config.custom_system_prompt, 400)}"""

        return self._truncate_text(base_prompt, self.max_prompt_chars)


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
        
        # 嘗試初始化 AI 服務（優先使用平台設定）
        ai_service = AIReplyService(store_config)
        if ai_service.is_available():
            self.ai_service = ai_service
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
        # 對關鍵事實問題優先使用固定回覆，避免 AI 幻覺
        direct_fact_reply = self._build_direct_fact_reply(message, store_info)
        if direct_fact_reply:
            return {
                'reply': direct_fact_reply,
                'used_ai': False,
                'matched_faq_id': None,
                'ai_model': None
            }

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
            if self.ai_service and getattr(self.config, 'enable_ai_reply', True):
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
                    'ai_model': self.ai_service.model if self.ai_service else None
                }
            else:
                # AI 未啟用，返回預設訊息
                return {
                    'reply': '抱歉，我無法回答這個問題。請直接聯繫店家，謝謝！',
                    'used_ai': False,
                    'matched_faq_id': None,
                    'ai_model': None
                }

    def _build_direct_fact_reply(self, message: str, store_info: Dict) -> Optional[str]:
        """針對電話、營業時間、訂位資訊提供一致且可驗證的固定回覆。"""
        normalized = re.sub(r'\s+', '', (message or '').lower())

        phone_keywords = ['電話', '聯絡', '客服', '電話號碼', '打給', '電話幾號']
        hours_keywords = ['營業時間', '幾點開', '幾點關', '開到幾點', '營業日', '休息日', '休息時間']
        reservation_keywords = ['訂位', '定位', '預約', '可訂位', '訂位資訊', '時段', '訂位時間', '幾人', '人數上限']

        asks_phone = any(keyword in normalized for keyword in phone_keywords)
        asks_hours = any(keyword in normalized for keyword in hours_keywords)
        asks_reservation = any(keyword in normalized for keyword in reservation_keywords)

        if not (asks_phone or asks_hours or asks_reservation):
            return None

        store_name = store_info.get('name', '本店')
        reply_parts = []

        if asks_phone:
            phone = store_info.get('phone') or '未提供'
            reply_parts.append(f"{store_name} 聯絡電話：{phone}")

        if asks_hours:
            opening_text = AIReplyService._format_opening_hours(store_info.get('opening_hours'))
            fixed_holidays = AIReplyService._format_fixed_holidays(store_info)
            reply_parts.append(f"營業時間：\n{opening_text}\n固定休息日：{fixed_holidays}")

        if asks_reservation:
            reservation_context = dict(store_info.get('reservation', {}) or {})
            reservation_context['fixed_holidays'] = AIReplyService._format_fixed_holidays(store_info)
            reservation_text = AIReplyService._format_reservation_info(reservation_context)
            reply_parts.append(f"訂位資訊：\n{reservation_text}")

        return '\n\n'.join(reply_parts)
    
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
