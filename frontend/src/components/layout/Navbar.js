import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import {
  FaBell,
  FaChevronDown,
  FaChevronRight,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaLock,
  FaSearch,
  FaStore,
  FaUser,
  FaUserCircle,
  FaUtensils,
} from 'react-icons/fa';
import { useAuth } from '../../store/AuthContext';
import { auth } from '../../lib/firebase';
import { authApi } from '../../api/authApi';
import { clearTokens } from '../../api/authTokens';
import styles from './Navbar.module.css';
import logo from '../../assets/logo.png';

const Navbar = ({ toggleSidebar }) => {
  const { isLoggedIn, user, login, logout, loading } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [authPanelOpen, setAuthPanelOpen] = useState(false);
  const [authRole, setAuthRole] = useState('customer');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickSearchKeyword, setQuickSearchKeyword] = useState('');
  const authPanelRef = useRef(null);
  const quickSearchRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  let homePath = '/';
  if (isLoggedIn && user) {
    homePath = user.user_type === 'merchant' ? '/dashboard' : '/customer-home';
  }

  const isDineInPage = location.pathname.includes('/dine-in/menu') || location.pathname.includes('/dine-in/order');

  if (isDineInPage) {
    const pathParts = location.pathname.split('/');
    const storeId = pathParts[2];
    const tableParam = location.search;
    homePath = `/store/${storeId}/dine-in/menu${tableParam}`;
  }

  useEffect(() => {
    setQuickSearchOpen(false);
    setAuthPanelOpen(false);
    setAuthError('');
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!authPanelOpen) return undefined;

    const handleOutsideClick = (e) => {
      if (authPanelRef.current && !authPanelRef.current.contains(e.target)) {
        setAuthPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [authPanelOpen]);

  useEffect(() => {
    if (!quickSearchOpen) return undefined;

    const handleOutsideClick = (e) => {
      if (quickSearchRef.current && !quickSearchRef.current.contains(e.target)) {
        setQuickSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [quickSearchOpen]);

  const handleLogout = () => {
    setDropdownOpen(false);

    if (isDineInPage) {
      const pathParts = location.pathname.split('/');
      const storeId = pathParts[2];
      const tableParam = location.search;
      const redirectPath = `/store/${storeId}/dine-in/menu${tableParam}`;
      logout(redirectPath);
      return;
    }

    logout();
  };

  const handleQuickSearchSubmit = (e) => {
    e.preventDefault();
    const keyword = quickSearchKeyword.trim();
    navigate(keyword ? `/customer-home?q=${encodeURIComponent(keyword)}` : '/customer-home');
    setQuickSearchOpen(false);
  };

  const currentPath = location.pathname + location.search;
  const shouldRedirectAfterCustomerLogin =
    location.pathname.includes('/store/') ||
    location.pathname.includes('/dine-in/') ||
    location.pathname.includes('/takeout/');

  const handleAuthRoleChange = (role) => {
    setAuthRole(role);
    setAuthError('');
  };

  const handleAuthInputChange = (e) => {
    const { name, value } = e.target;
    setAuthForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);

    try {
      const email = authForm.email.trim();
      const { password } = authForm;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      const backendResponse = await authApi.getBackendTokens(idToken, authRole);
      const backendUser = backendResponse.user;

      if (!backendUser?.user_type) {
        throw new Error('帳號資料缺少角色資訊，請重新登入。');
      }

      if (backendUser.user_type !== authRole) {
        await auth.signOut();
        clearTokens(authRole);
        setAuthError(authRole === 'customer'
          ? '這是店家帳號，請切換到「店家」登入。'
          : '這是顧客帳號，請切換到「顧客」登入。');
        return;
      }

      const redirectPath =
        authRole === 'customer' && shouldRedirectAfterCustomerLogin ? currentPath : null;

      setAuthPanelOpen(false);
      login(backendUser, redirectPath);
    } catch (err) {
      console.error('Navbar login failed:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setAuthError('帳號或密碼錯誤，請重新確認。');
      } else if (err.code === 'auth/invalid-email') {
        setAuthError('Email 格式不正確。');
      } else if (err.code === 'auth/too-many-requests') {
        setAuthError('嘗試次數過多，請稍後再試。');
      } else {
        setAuthError(err.message || '登入失敗，請稍後再試。');
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleCreateAccount = () => {
    setAuthPanelOpen(false);
    navigate(authRole === 'merchant' ? '/register/merchant' : '/register/customer');
  };

  const handleAuthShortcut = () => {
    setAuthError('');
    setAuthRole((role) => (role === 'customer' ? 'merchant' : 'customer'));
  };

  const renderUserSection = () => {
    if (loading) return null;

    if (isLoggedIn) {
      return (
        <div className={styles['profile-section']}>
          {user?.user_type === 'customer' && (
            <div className={styles['quick-search-wrap']} ref={quickSearchRef}>
              {!quickSearchOpen ? (
                <button
                  type="button"
                  className={styles['quick-search-btn']}
                  title="搜尋店家"
                  onClick={() => setQuickSearchOpen(true)}
                >
                  <FaUtensils className={styles['quick-search-icon']} />
                  Explore
                </button>
              ) : (
                <form className={styles.searchBox} onSubmit={handleQuickSearchSubmit}>
                  <input
                    className={styles.searchInput}
                    type="text"
                    value={quickSearchKeyword}
                    onChange={(e) => setQuickSearchKeyword(e.target.value)}
                    placeholder="輸入店家或料理"
                    autoFocus
                  />
                  <button className={styles.searchButton} type="submit" aria-label="搜尋">
                    <FaSearch />
                  </button>
                </form>
              )}
            </div>
          )}

          {user?.user_type === 'customer' && (
            <Link
              to="/customer/orders"
              state={{ activeTab: 'notifications' }}
              className={styles['notification-btn']}
              title="訂單通知"
            >
              <FaBell />
            </Link>
          )}

          <button className={styles['avatar-btn']} onClick={() => setDropdownOpen((prev) => !prev)}>
            {user?.avatar_url && user.avatar_url.startsWith('data:image') ? (
              <img src={user.avatar_url} alt={user.username} className={styles['avatar-img']} />
            ) : (
              user?.username?.charAt(0).toUpperCase() || 'U'
            )}
          </button>

          {dropdownOpen && (
            <ul className={styles['profile-dropdown']}>
              <li><Link to="/profile" onClick={() => setDropdownOpen(false)}>個人資料</Link></li>
              {user?.user_type === 'customer' && (
                <li><Link to="/customer/loyalty" onClick={() => setDropdownOpen(false)}>我的會員</Link></li>
              )}
              <li><button onClick={handleLogout}>登出</button></li>
            </ul>
          )}
        </div>
      );
    }

    return (
      <div className={styles['auth-entry']} ref={authPanelRef}>
        <button
          type="button"
          className={`${styles['auth-trigger']} ${authPanelOpen ? styles['auth-trigger-open'] : ''}`}
          onClick={() => setAuthPanelOpen((prev) => !prev)}
          aria-expanded={authPanelOpen}
        >
          <FaUserCircle />
          <span>登入 / 註冊</span>
          <FaChevronDown className={styles['auth-trigger-chevron']} />
        </button>

        {authPanelOpen && (
          <div className={styles['auth-panel']}>
            <div className={styles['auth-tabs']} role="tablist" aria-label="登入身分">
              <button
                type="button"
                className={authRole === 'customer' ? styles['auth-tab-active'] : ''}
                onClick={() => handleAuthRoleChange('customer')}
              >
                <FaUser />
                顧客
              </button>
              <button
                type="button"
                className={authRole === 'merchant' ? styles['auth-tab-active'] : ''}
                onClick={() => handleAuthRoleChange('merchant')}
              >
                <FaStore />
                店家
              </button>
            </div>

            <p className={styles['auth-helper']}>
              {authRole === 'customer'
                ? '瀏覽餐廳不用登入，登入後享受更多個人化體驗！'
                : '登入店家帳號，管理餐廳資訊、訂單與營運流程。'}
            </p>

            <form className={styles['auth-panel-form']} onSubmit={handleAuthSubmit}>
              <label className={styles['auth-field']}>
                <FaEnvelope />
                <input
                  type="email"
                  name="email"
                  value={authForm.email}
                  onChange={handleAuthInputChange}
                  placeholder="電子郵件 / 帳號"
                  autoComplete="email"
                  required
                />
              </label>

              <label className={styles['auth-field']}>
                <FaLock />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={authForm.password}
                  onChange={handleAuthInputChange}
                  placeholder="密碼"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className={styles['password-toggle']}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </label>

              {authError && <p className={styles['auth-error']}>{authError}</p>}

              <button className={styles['auth-submit']} type="submit" disabled={authSubmitting}>
                {authSubmitting ? '登入中...' : '登入'}
              </button>
            </form>

            <div className={styles['auth-divider']}><span>或</span></div>

            <button className={styles['create-account-btn']} type="button" onClick={handleCreateAccount}>
              建立新帳號
            </button>

            <button className={styles['auth-shortcut']} type="button" onClick={handleAuthShortcut}>
              {authRole === 'customer' ? <FaStore /> : <FaUser />}
              <span>{authRole === 'customer' ? '我是店家，前往商家中心' : '我是顧客，回到顧客登入'}</span>
              <FaChevronRight />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles['navbar-left']}>
        <button className={styles['sidebar-toggle']} onClick={toggleSidebar} aria-label="Toggle sidebar menu">
          ☰
        </button>
        <div className={styles['navbar-logo']}>
          <Link to={homePath}><img src={logo} alt="Dineverse" className={styles['navbar-logo']} /></Link>
        </div>
      </div>
      {renderUserSection()}
    </nav>
  );
};

export default Navbar;
