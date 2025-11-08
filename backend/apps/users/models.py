from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        return self.create_user(email, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    USER_TYPE_CHOICES = (
        ('customer', 'Customer'),
        ('merchant', 'Merchant'),
    )

    firebase_uid = models.CharField(max_length=255, unique=True)
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150)
    user_type = models.CharField(max_length=10, choices=USER_TYPE_CHOICES, default='customer')
    avatar_url = models.TextField(blank=True, default='')
    phone_number = models.CharField(max_length=20, blank=True, default='')
    address = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'firebase_uid']

    def __str__(self):
        return self.email

class Merchant(models.Model):
    PLAN_CHOICES = (
        ('basic', '基本方案'),
        ('premium', '進階方案'),
        ('enterprise', '企業方案'),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='merchant_profile')
    company_account = models.CharField(max_length=8, unique=True, verbose_name='公司統編')
    plan = models.CharField(
        max_length=20,
        choices=PLAN_CHOICES,
        blank=True,  # 允許為空
        null=True,   # 允許資料庫中為 NULL
        verbose_name='付費方案'
    )
    # 您未來可以為商家新增更多欄位
    # business_license_image = models.ImageField(upload_to='licenses/', blank=True, null=True)
    # contact_person = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.company_account}"

