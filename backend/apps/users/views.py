from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import UserSerializer
from .models import User
from rest_framework_simplejwt.tokens import RefreshToken
from firebase_admin import auth as firebase_auth
from rest_framework.permissions import AllowAny, IsAuthenticated # 引入 AllowAny

class FirebaseTokenLoginView(APIView):
    authentication_classes = [] # 豁免此視圖的全域 JWT 驗證
    permission_classes = [AllowAny] # 將此視圖設定為公開

    """
    Receives a Firebase ID token and returns a pair of JWT tokens.
    """
    def post(self, request, *args, **kwargs):
        id_token = request.data.get('id_token')
        if not id_token:
            return Response({'error': 'ID token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Verify the ID token with Firebase Admin SDK
            decoded_token = firebase_auth.verify_id_token(id_token, check_revoked=False, clock_skew_seconds=5)
            uid = decoded_token['uid']

            # Get or create the user in your Django database
            # 注意：如果用戶不存在，會使用預設值 'customer' 創建
            # 這意味著用戶必須先通過註冊流程才能正確設定 user_type
            try:
                user = User.objects.get(firebase_uid=uid)
            except User.DoesNotExist:
                # 如果用戶不存在，創建新用戶（預設為 customer）
                # 這種情況應該很少見，因為正常流程是先註冊再登入
                user = User.objects.create(
                    firebase_uid=uid,
                    email=decoded_token.get('email'),
                    username=decoded_token.get('name', decoded_token.get('email')),
                    user_type='customer'  # 預設為 customer，如果實際是 merchant，需要通過註冊流程
                )

            # Generate JWT tokens for the user
            refresh = RefreshToken.for_user(user)
            
            # 序列化使用者資料
            user_serializer = UserSerializer(user)
            
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': user_serializer.data  # 將使用者資料一起回傳
            })

        except firebase_auth.InvalidIdTokenError as e:
            # 更具體的錯誤，方便前端判斷
            return Response({'error': 'Invalid Firebase ID token', 'detail': str(e)}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({'error': 'An unexpected error occurred', 'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserMeView(APIView):
    """
    API view to retrieve the currently authenticated user's details.
    """
    permission_classes = [IsAuthenticated] # Requires a valid token

    def get(self, request, format=None):
        """
        Handles GET request to return the user associated with the token.
        """
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class UserRegisterView(APIView):
    permission_classes = [AllowAny] # 註冊也應該是公開的
    """
    API view for user registration.
    """
    def post(self, request, format=None):
        """
        Handles POST request to create a new user.
        """
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            try:
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                # 捕獲資料庫錯誤或其他異常
                error_detail = str(e)
                # 檢查是否是唯一性約束錯誤
                if 'UNIQUE constraint' in error_detail or 'unique constraint' in error_detail.lower():
                    if 'email' in error_detail.lower():
                        return Response({'error': '此電子郵件已被註冊', 'detail': error_detail}, status=status.HTTP_400_BAD_REQUEST)
                    elif 'firebase_uid' in error_detail.lower():
                        return Response({'error': '此帳號已被註冊', 'detail': error_detail}, status=status.HTTP_400_BAD_REQUEST)
                    else:
                        return Response({'error': '資料已存在', 'detail': error_detail}, status=status.HTTP_400_BAD_REQUEST)
                # 其他錯誤
                return Response({'error': '註冊失敗', 'detail': error_detail}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserDetailView(APIView):
    """
    API view to retrieve or update a user's details by UID.
    """

    def get(self, request, uid, format=None):
        """
        Handles GET request to retrieve a user by UID.
        """
        try:
            user = User.objects.get(firebase_uid=uid)
            serializer = UserSerializer(user)
            return Response(serializer.data)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    def put(self, request, uid, format=None):
        """
        Handles PUT request to update a user by UID.
        """
        try:
            user = User.objects.get(firebase_uid=uid)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
