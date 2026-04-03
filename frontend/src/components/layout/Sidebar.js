import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { useAuth } from '../../store/AuthContext';
import { useStore } from '../../store/StoreContext';
import styles from './Sidebar.module.css';

function MenuSection({ title, items, onLinkClick }) {
  return (
    <section className={styles.section}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      <ul className={styles.sectionList}>
        {items.map((item) => (
          <li key={item.key} className={item.disabled ? styles.disabled : ''}>
            <Link
              to={item.to}
              onClick={(e) => {
                if (item.disabled) {
                  e.preventDefault();
                  return;
                }
                item.onClick?.(e);
                onLinkClick?.();
              }}
              className={styles.menuItem}
            >
              <span className={styles.menuLabel}>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const Sidebar = ({ isOpen }) => {
  const { user } = useAuth();
  const { storeSettings } = useStore();
  const preLayersRef = useRef(null);
  const panelRef = useRef(null);
  const openTlRef = useRef(null);
  const closeTlRef = useRef(null);

  const handleReservationClick = useCallback((e) => {
    if (!user) {
      e.preventDefault();
      window.location.href = '/guest-lookup';
    }
  }, [user]);

  const handleOrderClick = useCallback((e) => {
    if (!user) {
      e.preventDefault();
      window.location.href = '/order-lookup';
    }
  }, [user]);

  const isCustomer = !user || user.user_type === 'customer';

  const sections = useMemo(() => {
    if (isCustomer) {
      return [
        {
          title: '功能選單',
          items: [
            { key: 'customer-home', to: '/customer-home', label: '搜尋店家', index: '01' },
            { key: 'my-reservations', to: '/my-reservations', label: '我的訂位', index: '02', onClick: handleReservationClick },
            { key: 'customer-orders', to: '/customer/orders', label: '我的訂單', index: '03', onClick: handleOrderClick }
          ]
        },
        {
          title: '會員中心',
          items: [
            { key: 'profile', to: '/profile', label: '個人資料', index: '04' },
            { key: 'customer-loyalty', to: '/customer/loyalty', label: '我的會員', index: '05' },
            { key: 'reviews', to: '/reviews', label: '我的評論', index: '06' },
            ...(user?.company_tax_id
              ? [{ key: 'layout-application', to: '/layout-application', label: '版型申請', index: '07' }]
              : [])
          ]
        }
      ];
    }

    return [
      {
        title: '店務管理',
        items: [
          { key: 'merchant-products', to: '/merchant/products', label: '商品管理', index: '01' },
          { key: 'merchant-dinein', to: '/merchant/dine-in', label: '內用設定', index: '02' },
          { key: 'merchant-settings', to: '/merchant/settings', label: '店家設定', index: '03' }
        ]
      },
      {
        title: '營運管理',
        items: [
          { key: 'merchant-schedule', to: '/merchant/schedule', label: '排班管理', index: '04' },
          { key: 'merchant-inventory', to: '/merchant/inventory', label: '庫存管理', index: '05' },
          { key: 'merchant-reports', to: '/merchant/reports', label: '財務報表', index: '06' }
        ]
      },
      {
        title: '訂單與客服',
        items: [
          { key: 'merchant-orders', to: '/merchant/orders', label: '訂單管理', index: '07' },
          { key: 'merchant-line-bot', to: '/merchant/line-bot', label: 'LINE BOT', index: '08' }
        ]
      },
      {
        title: '模組開關',
        items: [
          {
            key: 'merchant-reservations',
            to: '/merchant/reservations',
            label: '訂位模組',
            index: '09',
            disabled: !storeSettings.enable_reservation
          },
          {
            key: 'merchant-loyalty',
            to: '/merchant/loyalty',
            label: '會員模組',
            index: '10',
            disabled: !storeSettings.enable_loyalty
          },
          {
            key: 'merchant-surplus-food',
            to: '/merchant/surplus-food',
            label: '惜食模組',
            index: '11',
            disabled: !storeSettings.enable_surplus_food
          }
        ]
      }
    ];
  }, [handleOrderClick, handleReservationClick, isCustomer, storeSettings.enable_loyalty, storeSettings.enable_reservation, storeSettings.enable_surplus_food, user?.company_tax_id]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const preLayersEl = preLayersRef.current;
    const layers = preLayersEl ? Array.from(preLayersEl.querySelectorAll(`.${styles.preLayer}`)) : [];
    if (!panel) return undefined;

    gsap.set([panel, ...layers], { xPercent: -100 });
    gsap.set(preLayersEl, { autoAlpha: 0 });
    gsap.set(panel.querySelectorAll(`.${styles.menuLabel}`), { yPercent: 120, opacity: 0 });

    return () => {
      gsap.killTweensOf([panel, ...layers]);
      gsap.killTweensOf(preLayersEl);
      gsap.killTweensOf(panel.querySelectorAll(`.${styles.menuLabel}`));
      openTlRef.current?.kill();
      closeTlRef.current?.kill();
    };
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    const layers = preLayersRef.current ? Array.from(preLayersRef.current.querySelectorAll(`.${styles.preLayer}`)) : [];
    if (!panel) return;

    const labels = Array.from(panel.querySelectorAll(`.${styles.menuLabel}`));
    gsap.killTweensOf([panel, ...layers, ...labels, preLayersRef.current]);
    openTlRef.current?.kill();
    closeTlRef.current?.kill();

    if (isOpen) {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
      tl.to(layers, { xPercent: 0, duration: 0.3, stagger: 0.04, force3D: true }, 0)
        .to(preLayersRef.current, { autoAlpha: 1, duration: 0.06 }, 0)
        .to(panel, { xPercent: 0, duration: 0.36, force3D: true }, 0.06)
        .to(labels, { yPercent: 0, opacity: 1, duration: 0.24, stagger: 0.03, force3D: true }, 0.14);
      openTlRef.current = tl;
    } else {
      const tl = gsap.timeline({
        defaults: { ease: 'power2.in' },
        onComplete: () => {
          gsap.set([panel, ...layers], { xPercent: -102 });
          gsap.set(preLayersRef.current, { autoAlpha: 0 });
        }
      });
      tl.to(labels, { yPercent: 120, opacity: 0, duration: 0.12, stagger: 0.015, force3D: true }, 0)
        .to(panel, { xPercent: -100, duration: 0.2, force3D: true }, 0.01)
        .to(layers, { xPercent: -100, duration: 0.2, stagger: { each: 0.03, from: 'end' }, force3D: true }, 0);
      closeTlRef.current = tl;
    }
  }, [isOpen]);

  return (
    <aside className={`${styles.sidebarShell} ${isOpen ? styles.open : ''}`} aria-hidden={!isOpen}>
      <div ref={preLayersRef} className={styles.preLayers} aria-hidden="true">
        <div className={styles.preLayer} style={{ background: '#f4e3d5' }} />
      </div>

      <div ref={panelRef} className={styles.panel}>
        <header className={styles.panelHeader}>
          <p className={styles.kicker}>{isCustomer ? 'Customer' : 'Merchant'}</p>
          <h3>{isCustomer ? '功能選單' : '店家後台'}</h3>
        </header>

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
