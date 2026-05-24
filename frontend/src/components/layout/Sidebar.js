import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { gsap } from 'gsap';
import {
  FiAward,
  FiBriefcase,
  FiCalendar,
  FiClipboard,
  FiClock,
  FiGrid,
  FiMessageSquare,
  FiPackage,
  FiSettings,
  FiShoppingBag,
  FiStar,
  FiTag,
  FiTrendingUp,
  FiUser,
} from 'react-icons/fi';
import { useAuth } from '../../store/AuthContext';
import { useStore } from '../../store/StoreContext';
import styles from './Sidebar.module.css';

function MenuLink({ item }) {
  return (
    <NavLink
      to={item.to}
      onClick={(event) => {
        if (item.disabled) {
          event.preventDefault();
          return;
        }
        item.onClick?.(event);
      }}
      className={({ isActive }) => `${styles.menuItem} ${isActive && item.highlightOnActive !== false ? styles.active : ''}`}
    >
      <span className={styles.menuIcon}>{item.icon}</span>
      <span className={styles.menuLabel}>{item.label}</span>
    </NavLink>
  );
}

function MenuSection({ title, items }) {
  return (
    <section className={styles.section}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      <ul className={styles.sectionList}>
        {items.map((item) => (
          <li key={item.key} className={item.disabled ? styles.disabled : ''}>
            <MenuLink item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { storeSettings } = useStore();
  const panelRef = useRef(null);
  const openTlRef = useRef(null);
  const closeTlRef = useRef(null);

  const handleReservationClick = useCallback((event) => {
    if (!user) {
      event.preventDefault();
      window.location.href = '/guest-lookup';
    }
  }, [user]);

  const handleOrderClick = useCallback((event) => {
    if (!user) {
      event.preventDefault();
      window.location.href = '/order-lookup';
    }
  }, [user]);

  const isCustomer = !user || user.user_type === 'customer';

  const sections = useMemo(() => {
    if (isCustomer) {
      return [
        {
          title: '顧客功能',
          items: [
            { key: 'customer-orders', to: '/customer/orders', label: '我的訂單', icon: <FiShoppingBag />, onClick: handleOrderClick },
            { key: 'my-reservations', to: '/my-reservations', label: '我的訂位', icon: <FiCalendar />, onClick: handleReservationClick },
            { key: 'customer-coupons', to: '/customer/coupons', label: '我的優惠券', icon: <FiTag /> },
          ],
        },
        {
          title: '會員中心',
          items: [
            { key: 'profile', to: '/profile', label: '個人資料', icon: <FiUser /> },
            { key: 'customer-loyalty', to: '/customer/loyalty', label: '我的會員', icon: <FiAward /> },
            { key: 'reviews', to: '/reviews', label: '我的評論', icon: <FiStar /> },
            { key: 'layout-application', to: '/layout-application', label: '排班申請', icon: <FiClipboard /> },
          ],
        },
      ];
    }

    return [
      {
        title: '商家功能',
        items: [
          { key: 'merchant-products', to: '/merchant/products', label: '商品管理', icon: <FiPackage /> },
          { key: 'merchant-dinein', to: '/merchant/dine-in', label: '內用設定', icon: <FiGrid /> },
          { key: 'merchant-settings', to: '/merchant/settings', label: '店家設定', icon: <FiSettings /> },
        ],
      },
      {
        title: '營運管理',
        items: [
          { key: 'merchant-schedule', to: '/merchant/schedule', label: '排班管理', icon: <FiCalendar /> },
          { key: 'merchant-actual-schedule', to: '/merchant/actual-schedule', label: '實際工時', icon: <FiClock /> },
          { key: 'merchant-inventory', to: '/merchant/inventory', label: '庫存管理', icon: <FiClipboard /> },
          { key: 'merchant-reports', to: '/merchant/reports', label: '財務報表', icon: <FiTrendingUp /> },
        ],
      },
      {
        title: '訂單與互動',
        items: [
          { key: 'merchant-orders', to: '/merchant/orders', label: '訂單管理', icon: <FiShoppingBag /> },
          { key: 'merchant-line-bot', to: '/merchant/line-bot', label: 'LINE BOT', icon: <FiMessageSquare /> },
        ],
      },
      {
        title: '加值功能',
        items: [
          {
            key: 'merchant-reservations',
            to: '/merchant/reservations',
            label: '訂位管理',
            icon: <FiCalendar />,
            disabled: !storeSettings.enable_reservation,
          },
          {
            key: 'merchant-loyalty',
            to: '/merchant/loyalty',
            label: '會員管理',
            icon: <FiAward />,
            disabled: !storeSettings.enable_loyalty,
          },
          {
            key: 'merchant-surplus-food',
            to: '/merchant/surplus-food',
            label: '惜食管理',
            icon: <FiBriefcase />,
            disabled: !storeSettings.enable_surplus_food,
          },
        ],
      },
    ];
  }, [
    handleOrderClick,
    handleReservationClick,
    isCustomer,
    storeSettings.enable_loyalty,
    storeSettings.enable_reservation,
    storeSettings.enable_surplus_food,
  ]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;

    const animatedItems = panel.querySelectorAll(`.${styles.sectionTitle}, .${styles.menuItem}`);
    gsap.set(panel, { xPercent: -104, autoAlpha: 0 });
    gsap.set(animatedItems, { x: -10, opacity: 0 });

    return () => {
      gsap.killTweensOf([panel, ...animatedItems]);
      openTlRef.current?.kill();
      closeTlRef.current?.kill();
    };
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const animatedItems = Array.from(panel.querySelectorAll(`.${styles.sectionTitle}, .${styles.menuItem}`));
    gsap.killTweensOf([panel, ...animatedItems]);
    openTlRef.current?.kill();
    closeTlRef.current?.kill();

    if (isOpen) {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
      tl.to(panel, { xPercent: 0, autoAlpha: 1, duration: 0.24, force3D: true }, 0)
        .to(animatedItems, { x: 0, opacity: 1, duration: 0.22, stagger: 0.05, force3D: true }, 0.08);
      openTlRef.current = tl;
    } else {
      const tl = gsap.timeline({ defaults: { ease: 'power2.in' } });
      tl.to(animatedItems, { x: -10, opacity: 0, duration: 0.1, stagger: { each: 0.012, from: 'end' }, force3D: true }, 0)
        .to(panel, { xPercent: -104, autoAlpha: 0, duration: 0.2, force3D: true }, 0.02);
      closeTlRef.current = tl;
    }
  }, [isOpen]);

  return (
    <aside className={`${styles.sidebarShell} ${isOpen ? styles.open : ''}`} data-expanded={isOpen}>
      <button
        type="button"
        className={styles.scrim}
        onClick={onClose}
        aria-label="關閉側邊選單"
        tabIndex={isOpen ? 0 : -1}
      />

      <div ref={panelRef} className={styles.panel}>
        <div className={styles.panelBody}>
          {sections.map((section) => (
            <MenuSection key={section.title} title={section.title} items={section.items} />
          ))}

        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
