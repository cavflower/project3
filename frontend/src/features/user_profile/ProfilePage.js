import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { bindLine } from '../../api/lineLoginApi';
import { claimPlatformCoupon, getMyPlatformCoupons } from '../../api/loyaltyApi';
import PaymentCards from './PaymentCards';
import LineBinding from '../../components/user/LineBinding';
import MerchantLineBinding from '../../components/merchant/MerchantLineBinding';
import styles from './ProfilePage.module.css';

const formatCouponValue = (coupon) => {
  const amount = Number(coupon.discount_value || 0);
  if (coupon.discount_type === 'percent') {
    return `${amount}% 折扣`;
  }
  return `折抵 NT$ ${amount.toLocaleString('zh-TW')}`;
};

const formatCouponStatus = (coupon) => {
  if (coupon.status === 'used') return '已使用';
  if (coupon.is_expired || coupon.status === 'expired') return '已過期';
  return '可使用';
};

const formatCouponExpiry = (value) => {
  if (!value) return '未設定期限';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ProfilePage = () => {
  const { user, updateUser, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone_number: '',
    gender: 'female',
  });
  const [currentPlan, setCurrentPlan] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [platformCoupons, setPlatformCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponClaiming, setCouponClaiming] = useState(false);
  const [handledCouponToken, setHandledCouponToken] = useState('');
  const fileInputRef = useRef(null);

  const personalSectionRef = useRef(null);
  const lineSectionRef = useRef(null);
  const companySectionRef = useRef(null);
  const paymentCardsRef = useRef(null);
  const merchantLineSectionRef = useRef(null);

  const loadPlatformCoupons = useCallback(async () => {
    if (!user || user.user_type !== 'customer') return;

    try {
      setCouponsLoading(true);
      const response = await getMyPlatformCoupons();
      const data = response?.data ?? response;
      setPlatformCoupons(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('載入優惠券失敗:', error);
      setPlatformCoupons([]);
    } finally {
      setCouponsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    setFormData({
      username: user.username || '',
      email: user.email || '',
      phone_number: user.phone_number || '',
      gender: user.gender || 'female',
    });
    setAvatarPreview(user.avatar_url || 'https://via.placeholder.com/150');

    if (user.user_type === 'merchant' && user.merchant_profile) {
      setCurrentPlan(user.merchant_profile.plan || '');
    }
  }, [user]);

  useEffect(() => {
    const lineUserId = searchParams.get('line_user_id');
    const displayName = searchParams.get('display_name');
    const pictureUrl = searchParams.get('picture_url');

    if (!lineUserId || !user) return;

    const doBind = async () => {
      try {
        await bindLine({
          line_user_id: lineUserId,
          display_name: displayName || '',
          picture_url: pictureUrl || '',
        });
        window.history.replaceState({}, '', window.location.pathname);
        alert('LINE 綁定成功');
      } catch (err) {
        alert(err.response?.data?.detail || 'LINE 綁定失敗');
      }
    };

    doBind();
  }, [searchParams, user]);

  useEffect(() => {
    if (user?.user_type === 'customer') {
      loadPlatformCoupons();
    }
  }, [loadPlatformCoupons, user]);

  useEffect(() => {
    const couponClaimToken = searchParams.get('coupon_claim_token');
    if (
      !couponClaimToken ||
      !user ||
      user.user_type !== 'customer' ||
      couponClaiming ||
      handledCouponToken === couponClaimToken
    ) {
      return;
    }

    const claimCoupon = async () => {
      try {
        setCouponClaiming(true);
        setHandledCouponToken(couponClaimToken);
        const response = await claimPlatformCoupon(couponClaimToken);
        const result = response?.data ?? response;
        await loadPlatformCoupons();
        alert(result.message || '優惠券已存入您的帳戶');
      } catch (error) {
        alert(error.response?.data?.detail || '優惠券領取失敗');
      } finally {
        setCouponClaiming(false);
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    claimCoupon();
  }, [couponClaiming, handledCouponToken, loadPlatformCoupons, searchParams, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const submissionData = {};

    if (avatarPreview && avatarPreview !== (user.avatar_url || 'https://via.placeholder.com/150')) {
      submissionData.avatar_url = avatarPreview;
    }

    Object.keys(formData).forEach((key) => {
      const initialValue = user[key] || '';
      if (formData[key] !== initialValue) submissionData[key] = formData[key];
    });

    if (Object.keys(submissionData).length === 0) {
      alert('沒有需要更新的資料');
      return;
    }

    try {
      await updateUser(submissionData);
      alert('個人資料已更新');
    } catch (error) {
      console.error('更新個人資料失敗:', error);
      alert(`更新失敗：${error.response?.data?.detail || error.message || '未知錯誤'}`);
    }
  };

  const getPlanName = (plan) => {
    const planNames = {
      basic: '基本方案',
      premium: '進階方案',
      enterprise: '企業方案',
    };
    return planNames[plan] || '尚未選擇方案';
  };

  const handleChangePlan = () => navigate('/select-plan');

  const scrollToSection = (ref) => {
    ref?.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const handleQuickAction = (action) => {
    switch (action) {
      case 'profile':
        scrollToSection(personalSectionRef);
        break;
      case 'line':
        scrollToSection(merchantLineSectionRef);
        break;
      case 'company':
        scrollToSection(companySectionRef);
        break;
      case 'faq':
        alert('常見問題功能整理中');
        break;
      case 'logout':
        logout();
        break;
      default:
        break;
    }
  };

  if (loading || !user) return <div>載入個人資料中...</div>;

  const membershipLabel = user.user_type === 'merchant' ? '店家會員' : '平台會員';
  const accountTypeLabel = user.user_type === 'merchant' ? '店家帳戶' : '一般帳戶';
  const merchantQuickActions = [
    { key: 'profile', label: '個人資料設定' },
    { key: 'line', label: 'LINE 綁定' },
    { key: 'company', label: '公司資訊' },
    { key: 'faq', label: '常見問題' },
    { key: 'logout', label: '登出', danger: true },
  ];

  return (
    <div className={styles['profile-page']}>
      <div className={styles['profile-wrapper']}>
        <div className={styles['profile-container']}>
          <form onSubmit={handleSubmit} className={styles['profile-form']}>
            <div className={styles['profile-sidebar']}>
              <h1>個人資料設定</h1>

              <div className={styles['avatar-shell']}>
                <div className={styles['avatar-upload-container']} onClick={() => fileInputRef.current.click()}>
                  <img src={avatarPreview} alt="Avatar" className={styles['avatar-preview']} />
                  <div className={styles['avatar-edit-overlay']}>
                    <span>更換頭像</span>
                  </div>
                </div>
              </div>

              <div className={styles['sidebar-profile-card']}>
                <p className={styles['sidebar-name']}>{formData.username || '使用者'}</p>
                <p className={styles['sidebar-subtitle']}>{accountTypeLabel}</p>
                <div className={styles['sidebar-level-chip']}>{membershipLabel}</div>
                <div className={styles['sidebar-meta-grid']}>
                  <div className={styles['meta-tile']}>
                    <span className={styles['meta-label']}>Email 綁定</span>
                    <span className={styles['meta-value']}>{formData.email ? '已完成' : '未設定'}</span>
                  </div>
                  <div className={styles['meta-tile']}>
                    <span className={styles['meta-label']}>公司加入</span>
                    <span className={styles['meta-value']}>{user.company_tax_id ? '已加入' : '未加入'}</span>
                  </div>
                </div>
              </div>

              {user.user_type === 'customer' ? (
                <div className={styles['sidebar-coupon-panel']}>
                  <div className={styles['coupon-panel-header']}>
                    <div>
                      <p className={styles['quick-title']}>我的優惠券</p>
                      <span className={styles['coupon-count']}>{platformCoupons.length} 張</span>
                    </div>
                    <button type="button" className={styles['coupon-refresh-btn']} onClick={loadPlatformCoupons}>
                      重新整理
                    </button>
                  </div>

                  {couponClaiming && (
                    <div className={styles['coupon-claiming-tip']}>正在同步剛領取的優惠券...</div>
                  )}

                  {couponsLoading ? (
                    <div className={styles['coupon-empty-state']}>載入優惠券中...</div>
                  ) : platformCoupons.length === 0 ? (
                    <div className={styles['coupon-empty-state']}>
                      目前還沒有平台優惠券。之後從 LINE 領取的優惠券都會存放在這裡。
                    </div>
                  ) : (
                    <div className={styles['coupon-list']}>
                      {platformCoupons.map((coupon) => (
                        <div key={coupon.id} className={styles['coupon-card']}>
                          <div className={styles['coupon-card-top']}>
                            <div>
                              <p className={styles['coupon-title']}>{coupon.title}</p>
                              <p className={styles['coupon-code']}>{coupon.code}</p>
                            </div>
                            <span
                              className={`${styles['coupon-status']} ${
                                coupon.status === 'used'
                                  ? styles['coupon-status-used']
                                  : coupon.is_expired || coupon.status === 'expired'
                                    ? styles['coupon-status-expired']
                                    : styles['coupon-status-active']
                              }`}
                            >
                              {formatCouponStatus(coupon)}
                            </span>
                          </div>
                          <p className={styles['coupon-value']}>{formatCouponValue(coupon)}</p>
                          {coupon.description && (
                            <p className={styles['coupon-description']}>{coupon.description}</p>
                          )}
                          <div className={styles['coupon-meta']}>
                            <span>最低消費 NT$ {Number(coupon.min_order_amount || 0).toLocaleString('zh-TW')}</span>
                            <span>到期：{formatCouponExpiry(coupon.expires_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="button" className={styles['customer-logout-btn']} onClick={() => logout()}>
                    登出
                  </button>
                </div>
              ) : (
                <div className={styles['sidebar-quick-panel']}>
                  <p className={styles['quick-title']}>快速功能</p>
                  <div className={styles['sidebar-quick-list']}>
                    {merchantQuickActions.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={`${styles['quick-action-btn']} ${item.danger ? styles['quick-action-danger'] : ''}`}
                        onClick={() => handleQuickAction(item.key)}
                      >
                        <span className={styles['quick-dot']} />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
                accept="image/*"
              />
            </div>

            <div className={styles['profile-main']} ref={personalSectionRef}>
              <div className={styles['form-group']}>
                <label htmlFor="username">使用者名稱</label>
                <input type="text" id="username" name="username" value={formData.username} onChange={handleChange} required />
              </div>

              <div className={styles['form-group']}>
                <label htmlFor="email">電子郵件</label>
                <input type="email" id="email" name="email" value={formData.email} readOnly />
              </div>

              <div className={styles['form-group']}>
                <label htmlFor="phone_number">手機號碼</label>
                <input type="tel" id="phone_number" name="phone_number" value={formData.phone_number} onChange={handleChange} />
              </div>

              <div className={styles['form-group']}>
                <label htmlFor="gender">性別</label>
                <div className={styles['gender-radio-group']}>
                  <label className={styles['radio-option']}>
                    <input type="radio" name="gender" value="female" checked={formData.gender === 'female'} onChange={handleChange} />
                    <span>女性</span>
                  </label>
                  <label className={styles['radio-option']}>
                    <input type="radio" name="gender" value="male" checked={formData.gender === 'male'} onChange={handleChange} />
                    <span>男性</span>
                  </label>
                  <label className={styles['radio-option']}>
                    <input type="radio" name="gender" value="other" checked={formData.gender === 'other'} onChange={handleChange} />
                    <span>其他</span>
                  </label>
                </div>
              </div>

              <button type="submit" className={styles['submit-btn']}>儲存變更</button>

              {user.user_type === 'customer' && (
                <section className={styles['inline-tools-section']}>
                  <div className={styles['inline-tools-grid']}>
                    <div className={styles['line-inline-tool']} ref={lineSectionRef}>
                      <LineBinding compact />
                    </div>
                    <div className={styles['company-inline-tool']} ref={companySectionRef}>
                      <JoinCompanySection user={user} updateUser={updateUser} compact />
                    </div>
                  </div>
                </section>
              )}
            </div>
          </form>
        </div>

        {user.user_type === 'merchant' && (
          <div className={styles['plan-sidebar']} ref={companySectionRef}>
            <h2>目前方案資訊</h2>
            <div className={styles['current-plan-display']}>
              <div className={styles['plan-badge']}>{getPlanName(currentPlan)}</div>

              {currentPlan === 'basic' && (
                <div className={styles['plan-details']}>
                  <p className={styles['plan-price']}>NT$ 499 / 月</p>
                  <ul className={styles['plan-features']}>
                    <li>基本店家管理與上架功能</li>
                    <li>一般會員經營工具</li>
                    <li>基礎營運報表與資料整理</li>
                  </ul>
                </div>
              )}

              {currentPlan === 'premium' && (
                <div className={styles['plan-details']}>
                  <p className={styles['plan-price']}>NT$ 999 / 月</p>
                  <ul className={styles['plan-features']}>
                    <li>進階數據分析與推播功能</li>
                    <li>完整會員經營與優惠工具</li>
                    <li>更多自訂營運設定</li>
                  </ul>
                </div>
              )}

              {currentPlan === 'enterprise' && (
                <div className={styles['plan-details']}>
                  <p className={styles['plan-price']}>NT$ 2,499 / 月</p>
                  <ul className={styles['plan-features']}>
                    <li>企業級管理與多角色支援</li>
                    <li>API 串接與完整後台權限</li>
                    <li>專屬客製與進階技術支援</li>
                  </ul>
                </div>
              )}

              {!currentPlan && (
                <div className={styles['plan-details']}>
                  <p className={styles['no-plan-text']}>尚未選擇方案</p>
                </div>
              )}
            </div>

            <button type="button" className={styles['change-plan-btn']} onClick={handleChangePlan}>變更方案</button>
          </div>
        )}

        {user.user_type === 'customer' && (
          <div ref={paymentCardsRef} className={styles['payment-column']}>
            <PaymentCards stretch />
          </div>
        )}
        {user.user_type === 'merchant' && (
          <div ref={merchantLineSectionRef}>
            <MerchantLineBinding />
          </div>
        )}
      </div>
    </div>
  );
};

const JoinCompanySection = ({ user, updateUser, compact = false }) => {
  const navigate = useNavigate();
  const [companyTaxId, setCompanyTaxId] = useState(user.company_tax_id || '');
  const [saving, setSaving] = useState(false);
  const hasJoinedCompany = Boolean(user.company_tax_id);

  useEffect(() => {
    setCompanyTaxId(user.company_tax_id || '');
  }, [user.company_tax_id]);

  const handleJoinCompany = async () => {
    if (!companyTaxId.trim()) {
      alert('請輸入公司統編');
      return;
    }

    if (companyTaxId.length !== 8 || !/^\d+$/.test(companyTaxId)) {
      alert('公司統編需為 8 碼數字');
      return;
    }

    setSaving(true);
    try {
      await updateUser({ company_tax_id: companyTaxId.trim() });
      alert('公司加入成功');
    } catch (error) {
      console.error('加入公司失敗:', error);
      alert(`加入公司失敗：${error.response?.data?.detail || error.message || '未知錯誤'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleLeaveCompany = async () => {
    if (!window.confirm('確定要退出目前加入的公司嗎？')) return;

    setSaving(true);
    try {
      await updateUser({ company_tax_id: null });
      setCompanyTaxId('');
      alert('已退出公司');
    } catch (error) {
      console.error('退出公司失敗:', error);
      alert(`退出公司失敗：${error.response?.data?.detail || error.message || '未知錯誤'}`);
    } finally {
      setSaving(false);
    }
  };

  const goToScheduleApplication = () => navigate('/layout-application');

  return (
    <div className={`${styles['join-company-section']} ${compact ? styles.compact : ''}`}>
      <h2>{hasJoinedCompany ? '公司資訊' : '加入公司'}</h2>
      <p className={styles['section-description']}>
        {hasJoinedCompany ? '已加入公司後，可以在排班申請與相關流程中沿用公司資訊。' : ''}
      </p>

      {hasJoinedCompany ? (
        <div className={styles['company-info']}>
          <div className={styles['company-status']}>
            <span className={`${styles['status-badge']} ${styles.success}`}>已成功加入</span>
          </div>
          <div className={styles['company-detail']}>
            <label>公司統編</label>
            <span className={styles['company-tax-id']}>{user.company_tax_id}</span>
          </div>
          <div className={styles['company-actions']}>
            <button type="button" className={styles['btn-schedule']} onClick={goToScheduleApplication}>
              前往排班
            </button>
            <button type="button" className={styles['btn-leave']} onClick={handleLeaveCompany} disabled={saving}>
              {saving ? '處理中...' : '退出公司'}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles['company-form']}>
          <div className={styles['form-group']}>
            <label htmlFor="companyTaxId">公司統編</label>
            <input
              type="text"
              id="companyTaxId"
              value={companyTaxId}
              onChange={(e) => setCompanyTaxId(e.target.value)}
              placeholder="請輸入 8 碼公司統編"
              maxLength={8}
              disabled={saving}
            />
          </div>
          <div className={styles['form-actions']}>
            <button
              type="button"
              className={styles['btn-save']}
              onClick={handleJoinCompany}
              disabled={saving || !companyTaxId.trim()}
            >
              {saving ? '加入中...' : '加入公司'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
