# Generated manually to merge 0010_normalize_tax_ids and 0010_remove_user_groups_remove_user_user_permissions_and_more
from django.db import migrations, models


def normalize_tax_ids(apps, schema_editor):
    """統一現有統編格式（去除空格、轉為大寫）並創建對應的 Company 記錄"""
    User = apps.get_model('users', 'User')
    Merchant = apps.get_model('users', 'Merchant')
    Company = apps.get_model('users', 'Company')
    
    # 1. 統一 User 的 company_tax_id 格式
    users_updated = 0
    for user in User.objects.exclude(company_tax_id__isnull=True).exclude(company_tax_id=''):
        original_tax_id = user.company_tax_id
        normalized_tax_id = original_tax_id.strip().upper()
        if original_tax_id != normalized_tax_id:
            user.company_tax_id = normalized_tax_id
            user.save(update_fields=['company_tax_id'])
            users_updated += 1
            print(f"更新用戶 {user.username} 的統編: '{original_tax_id}' -> '{normalized_tax_id}'")
        
        # 為每個統編創建對應的 Company 記錄（如果不存在）
        if normalized_tax_id:
            company, created = Company.objects.get_or_create(
                tax_id=normalized_tax_id,
                defaults={'name': f"公司 {normalized_tax_id}"}
            )
            if created:
                print(f"創建公司記錄: {company.name} ({company.tax_id})")
    
    print(f"共更新 {users_updated} 個用戶的統編格式")
    
    # 2. 統一 Merchant 的 company_account 格式
    merchants_updated = 0
    for merchant in Merchant.objects.all():
        original_account = merchant.company_account
        normalized_account = original_account.strip().upper() if original_account else ''
        if original_account != normalized_account:
            merchant.company_account = normalized_account
            merchant.save(update_fields=['company_account'])
            merchants_updated += 1
            print(f"更新商家 {merchant.user.username} 的統編: '{original_account}' -> '{normalized_account}'")
        
        # 為每個統編創建對應的 Company 記錄（如果不存在）
        if normalized_account:
            company, created = Company.objects.get_or_create(
                tax_id=normalized_account,
                defaults={'name': f"公司 {normalized_account}"}
            )
            if created:
                print(f"創建公司記錄: {company.name} ({company.tax_id})")
    
    print(f"共更新 {merchants_updated} 個商家的統編格式")


def reverse_normalize_tax_ids(apps, schema_editor):
    """反向操作：無法完全還原，因為我們不知道原始格式"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_merge_company_and_paymentcard'),
    ]

    replaces = [
        ('users', '0010_normalize_tax_ids'),
        ('users', '0010_remove_user_groups_remove_user_user_permissions_and_more'),
    ]

    operations = [
        # From 0010_normalize_tax_ids
        migrations.RunPython(normalize_tax_ids, reverse_normalize_tax_ids),
        
        # From 0010_remove_user_groups_remove_user_user_permissions_and_more
        migrations.RemoveField(
            model_name='user',
            name='groups',
        ),
        migrations.RemoveField(
            model_name='user',
            name='user_permissions',
        ),
        migrations.AddField(
            model_name='user',
            name='is_superuser',
            field=models.BooleanField(default=False, verbose_name='超級用戶'),
        ),
    ]
