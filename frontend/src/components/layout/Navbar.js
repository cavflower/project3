import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaBell, FaSearch, FaUtensils } from 'react-icons/fa';
import { useAuth } from '../../store/AuthContext';
import styles from './Navbar.module.css';
import logo from '../../assets/logo.png';

const Navbar = ({ toggleSidebar }) => {
  const { isLoggedIn, user, logout, loading } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickSearchKeyword, setQuickSearchKeyword] = useState('');
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
  }, [location.pathname, location.search]);

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

    const currentPath = location.pathname + location.search;
    const shouldRedirect =
      location.pathname.includes('/store/') ||
      location.pathname.includes('/dine-in/') ||
      location.pathname.includes('/takeout/');
    const loginPath = shouldRedirect
      ? `/login/customer?redirect=${encodeURIComponent(currentPath)}`
      : '/login/customer';

    return (
      <ul className={styles['navbar-links']}>
        <li><Link to={loginPath}>登入</Link></li>
        <li><Link to="/register/customer" className={styles['register-btn']}>註冊</Link></li>
      </ul>
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
