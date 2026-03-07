import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { updateMerchantPlan } from '../../api/authApi';
import { getMyStore } from '../../api/storeApi';
import { bindLine } from '../../api/lineLoginApi';
import PaymentCards from './PaymentCards';
import LineBinding from '../../components/user/LineBinding';
import MerchantLineBinding from '../../components/merchant/MerchantLineBinding';
import styles from './ProfilePage.module.css';

const ProfilePage = () => {
  const { user, updateUser, login, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone_number: '',
    gender: 'female',
  });
  const [selectedPlan, setSelectedPlan] = useState('');
  const [currentPlan, setCurrentPlan] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [platformFeeDiscount, setPlatformFeeDiscount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        phone_number: user.phone_number || '',
        gender: user.gender || 'female',
      });
      // 如果使用者有頭像 URL，則使用它，否則使用預設圖片
      setAvatarPreview(user.avatar_url || 'https://via.placeholder.com/150');

      // 如果是商家，設定方案並載入折扣資訊
      if (user.user_type === 'merchant' && user.merchant_profile) {
        const plan = user.merchant_profile.plan || '';
        setCurrentPlan(plan);
        setSelectedPlan(plan);
        // 直接從 merchant_profile 讀取折扣資訊
        setPlatformFeeDiscount(user.merchant_profile.platform_fee_discount || 0);
        setDiscountReason(user.merchant_profile.discount_reason || '');
      }
    }
  }, [user]);

  // 處理 LINE 綁定回調
  useEffect(() => {
    const lineUserId = searchParams.get('line_user_id');
    const displayName = searchParams.get('display_name');
    const pictureUrl = searchParams.get('picture_url');

    if (lineUserId && user) {
      // 有 LINE 資料，執行綁定
      const doBind = async () => {
        try {
          await bindLine({
            line_user_id: lineUserId,
            display_name: displayName || '',
            picture_url: pictureUrl || '',
          });
          // 清除 URL 參數
          window.history.replaceState({}, '', window.location.pathname);
          alert('LINE 帳號綁定成功！');
        } catch (err) {
          alert(err.response?.data?.detail || 'LINE 綁定失敗');
        }
      };
      doBind();
    }
  }, [searchParams, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 建立一個純粹的 JavaScript 物件來存放要提交的資料
    const submissionData = {};

    // 1. 處理頭像檔案 (Base64)
    if (avatarPreview && avatarPreview !== (user.avatar_url || 'https://via.placeholder.com/150')) {
      submissionData.avatar_url = avatarPreview;
    }

    // 2. 處理其他文字欄位
    Object.keys(formData).forEach((key) => {
      const initialValue = user[key] || '';
      if (formData[key] !== initialValue) {
        submissionData[key] = formData[key];
      }
    });

    // 檢查是否有任何資料需要更新
    if (Object.keys(submissionData).length > 0) {
      try {
        await updateUser(submissionData);
        alert('個人資料更新成功！');
      } catch (error) {
        console.error('更新失敗:', error);
        alert(`更新失敗：${error.response?.data?.detail || error.message || '請稍後再試。'}`);
      }
    } else {
      alert('沒有偵測到任何變更。');
    }
  };

  const getPlanName = (plan) => {
    const planNames = {
      'basic': '基本方案',
      'premium': '進階方案',
      'enterprise': '企業方案'
    };
    return planNames[plan] || '未設定';
  };

  const handleChangePlan = () => {
    navigate('/select-plan');
  };

  if (loading || !user) {
    return <div>正在載入使用者資料...</div>;
  }

  return (
    <div className={styles['profile-page']}>
      <div className={styles['profile-wrapper']}>
        <div className={styles['profile-container']}>
          <form onSubmit={handleSubmit} className={styles['profile-form']}>
            <div className={styles['profile-sidebar']}>
              <h1>編輯個人資料</h1>
              <div className={styles['avatar-upload-container']} onClick={() => fileInputRef.current.click()}>
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className={styles['avatar-preview']}
                />
                <div className={styles['avatar-edit-overlay']}>
                  <span>更換頭像</span>
                </div>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
                accept="image/*"
              />
            </div>

            <div className={styles['profile-main']}>
              <div className={styles['form-group']}>
                <label htmlFor="username">名稱</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className={styles['form-group']}>
                <label htmlFor="email">電子郵件 (無法修改)</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  readOnly
                />
              </div>
              <div className={styles['form-group']}>
                <label htmlFor="phone_number">電話號碼</label>
                <input
                  type="tel"
                  id="phone_number"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                />
              </div>

              <div className={styles['form-group']}>
                <label htmlFor="gender">性別</label>
                <div className={styles['gender-radio-group']}>
                  <label className={styles['radio-option']}>
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={formData.gender === 'female'}
                      onChange={handleChange}
                    />
                    <span>小姐</span>
                  </label>
                  <label className={styles['radio-option']}>
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={formData.gender === 'male'}
                      onChange={handleChange}
                    />
                    <span>先生</span>
                  </label>
                  <label className={styles['radio-option']}>
                    <input
                      type="radio"
                      name="gender"
                      value="other"
                      checked={formData.gender === 'other'}
                      onChange={handleChange}
                    />
                    <span>其他</span>
                  </label>
                </div>
              </div>

              <button type="submit" className={styles['submit-btn']}>
                儲存變更
              </button>
            </div>
          </form>
        </div>

        {user.user_type === 'merchant' && (
          <div className={styles['plan-sidebar']}>
            <h2>現在選擇的方案</h2>
            <div className={styles['current-plan-display']}>
              <div className={styles['plan-badge']}>
                {getPlanName(currentPlan)}
              </div>
              {currentPlan === 'basic' && (
                <div className={styles['plan-details']}>
                  <p className={styles['plan-price']}>NT$ 499/月</p>
                  <ul className={styles['plan-features']}>
                    <li>平台基礎功能(販賣、排班...)</li>
                    <li>基本訂單管理+惜福品</li>
                    <li>營運報表</li>
                  </ul>
                </div>
              )}
              {currentPlan === 'premium' && (
                <div className={styles['plan-details']}>
                  <p className={styles['plan-price']}>NT$ 999/月</p>
                  <ul className={styles['plan-features']}>
                    <li>包含基本方案所有功能</li>
                    <li>開放特殊功能(訂位、會員)</li>
                    <li>中優先級別</li>
                  </ul>
                </div>
              )}
              {currentPlan === 'enterprise' && (
                <div className={styles['plan-details']}>
                  <p className={styles['plan-price']}>NT$ 2,499/月</p>
                  <ul className={styles['plan-features']}>
                    <li>包含進階方案所有功能</li>
                    <li>LINE BOT個人化推播</li>
                    <li>高優先級別</li>
                  </ul>
                </div>
              )}
              {!currentPlan && (
                <div className={styles['plan-details']}>
                  <p className={styles['no-plan-text']}>您尚未選擇方案</p>
                </div>
              )}
            </div>
            <button className={styles['change-plan-btn']} onClick={handleChangePlan}>
              更改方案
            </button>

            {/* 方案費用折扣資訊 */}
            <div className={styles['discount-info-section']}>
              <h2>方案費用折扣</h2>
              <div className={styles['discount-info-display']}>
                {platformFeeDiscount > 0 ? (
                  <>
                    <div className={styles['discount-badge-large']}>
                      折抵{platformFeeDiscount}%費用
                    </div>
                    <div className={styles['discount-details']}>
                      <p className={styles['discount-label']}>目前折扣：</p>
                      <p className={styles['discount-value']}>{platformFeeDiscount}%</p>

                      <p className={styles['discount-label']}>折扣後方案費用：</p>
                      <p className={styles['discount-value']}>
                        {currentPlan === 'basic' && `NT$ ${(499 * (1 - platformFeeDiscount / 100)).toFixed(0)}/月`}
                        {currentPlan === 'premium' && `NT$ ${(999 * (1 - platformFeeDiscount / 100)).toFixed(0)}/月`}
                        {currentPlan === 'enterprise' && `NT$ ${(2499 * (1 - platformFeeDiscount / 100)).toFixed(0)}/月`}
                        {!currentPlan && 'N/A'}
                      </p>

                      {discountReason && (
                        <>
                          <p className={styles['discount-label']}>折扣原因：</p>
                          <p className={styles['discount-reason']}>{discountReason}</p>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className={styles['no-discount-text']}>
                    <p>目前沒有方案費用折扣</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 信用卡管理區域 - 僅顧客端顯示 */}
        {user.user_type === 'customer' && <PaymentCards />}

        {/* LINE 綁定區塊 */}
        {user.user_type === 'customer' && <LineBinding />}
        {user.user_type === 'merchant' && <MerchantLineBinding />}

        {/* 加入公司區塊 - 僅顧客端顯示 */}
        {user.user_type === 'customer' && (
          <JoinCompanySection user={user} updateUser={updateUser} />
        )}
      </div>
    </div>
  );
};

// 加入公司區塊元件
const JoinCompanySection = ({ user, updateUser }) => {
  const navigate = useNavigate();
  const [companyTaxId, setCompanyTaxId] = useState(user.company_tax_id || '');
  const [saving, setSaving] = useState(false);

  // 判斷是否已加入公司
  const hasJoinedCompany = !!user.company_tax_id;

  // 當 user.company_tax_id 變化時同步更新本地狀態
  useEffect(() => {
    setCompanyTaxId(user.company_tax_id || '');
  }, [user.company_tax_id]);

  const handleJoinCompany = async () => {
    if (!companyTaxId.trim()) {
      alert('請輸入公司統編');
      return;
    }

    if (companyTaxId.length !== 8 || !/^\d+$/.test(companyTaxId)) {
      alert('公司統編必須為8位數字');
      return;
    }

    setSaving(true);
    try {
      await updateUser({ company_tax_id: companyTaxId.trim() });
      alert('加入公司成功！現在可以前往「排班申請」頁面申請排班。');
    } catch (error) {
      console.error('更新失敗:', error);
      alert(`加入失敗：${error.response?.data?.detail || error.message || '請稍後再試。'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleLeaveCompany = async () => {
    if (!window.confirm('確定要離開公司嗎？離開後將無法申請排班。')) {
      return;
    }

    setSaving(true);
    try {
      await updateUser({ company_tax_id: null });
      setCompanyTaxId('');
      alert('已離開公司');
    } catch (error) {
      console.error('更新失敗:', error);
      alert(`操作失敗：${error.response?.data?.detail || error.message || '請稍後再試。'}`);
    } finally {
      setSaving(false);
    }
  };

  const goToScheduleApplication = () => {
    navigate('/layout-application');
  };

  return (
    <div className={styles['join-company-section']}>
      <h2>🏢 {hasJoinedCompany ? '公司資訊' : '加入公司'}</h2>
      <p className={styles['section-description']}>
        {hasJoinedCompany
          ? '您已加入公司，可以前往「排班申請」頁面申請排班。'
          : '輸入公司統編後，即可前往「排班申請」頁面向該公司的店家申請排班。'
        }
      </p>

      {hasJoinedCompany ? (
        // 已加入公司狀態 - 顯示統編和退出按鈕
        <div className={styles['company-info']}>
          <div className={styles['company-status']}>
            <span className={`${styles['status-badge']} ${styles.success}`}>✓ 已加入公司</span>
          </div>
          <div className={styles['company-detail']}>
            <label>公司統編：</label>
            <span className={styles['company-tax-id']}>{user.company_tax_id}</span>
          </div>
          <div className={styles['company-actions']}>
            <button
              className={styles['btn-schedule']}
              onClick={goToScheduleApplication}
            >
              前往排班申請
            </button>
            <button
              className={styles['btn-leave']}
              onClick={handleLeaveCompany}
              disabled={saving}
            >
              {saving ? '處理中...' : '退出公司'}
            </button>
          </div>
        </div>
      ) : (
        // 尚未加入公司 - 顯示輸入框
        <div className={styles['company-form']}>
          <div className={styles['form-group']}>
            <label htmlFor="companyTaxId">公司統編</label>
            <input
              type="text"
              id="companyTaxId"
              value={companyTaxId}
              onChange={(e) => setCompanyTaxId(e.target.value)}
              placeholder="請輸入8位數公司統編"
              maxLength={8}
              disabled={saving}
            />
          </div>
          <div className={styles['form-actions']}>
            <button
              className={styles['btn-save']}
              onClick={handleJoinCompany}
              disabled={saving || !companyTaxId.trim()}
            >
              {saving ? '儲存中...' : '加入公司'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
