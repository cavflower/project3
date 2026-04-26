import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { getStore } from '../../api/storeApi';
import { getLoyaltyAccounts } from '../../api/loyaltyApi';
import styles from './StoreBrowse.module.css';

const TEXT = {
  welcome: '\u6b61\u8fce\u5149\u81e8',
  customer: '\u9867\u5ba2',
  member: '\u6703\u54e1',
  reservationTitle: '\u7dda\u4e0a\u8a02\u4f4d',
  takeoutTitle: '\u5916\u5e36\u81ea\u53d6',
  reservationInfo: '\u63d0\u524d\u9810\u8a02\uff0c\u4eab\u53d7\u7121\u7e2b\u7528\u9910\u9ad4\u9a57',
  takeoutInfo: '\u9810\u8a08\u53d6\u9910\u6642\u9593\uff1a20-30 \u5206\u9418',
  reserveNow: '\u7acb\u5373\u8a02\u4f4d',
  orderNow: '\u7acb\u5373\u9ede\u9910',
  memberReserveHint: '\u6703\u54e1\u5feb\u901f\u8a02\u4f4d\uff0c\u7121\u9700\u586b\u5beb\u8cc7\u6599',
  guestReserveHint: '\u8a02\u4f4d\u6642\u8acb\u586b\u5beb\u806f\u7d61\u8cc7\u6599',
  takeoutHint: '\u53ef\u7dda\u4e0a\u4ed8\u6b3e\uff0c\u5230\u5e97\u76f4\u63a5\u53d6\u9910',
  takeoutDisabled: '\u5e97\u5bb6\u76ee\u524d\u672a\u958b\u653e\u5916\u5e36\u81ea\u53d6',
};

function StoreBrowse() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { storeId } = useParams();
  const [store, setStore] = useState(null);
  const [loyaltyAccount, setLoyaltyAccount] = useState(null);

  const displayName = useMemo(() => (
    user?.name ||
    user?.username ||
    (user?.email ? user.email.split('@')[0] : '') ||
    TEXT.customer
  ), [user]);

  const memberLabel = useMemo(() => (
    loyaltyAccount?.current_level_name ||
    user?.membership_level_name ||
    user?.membership_level?.name ||
    user?.level_name ||
    TEXT.member
  ), [loyaltyAccount, user]);

  useEffect(() => {
    const loadStore = async () => {
      try {
        const response = await getStore(storeId);
        setStore(response.data);
      } catch (err) {
        console.error('Failed to load store:', err);
      }
    };
    loadStore();
  }, [storeId]);

  useEffect(() => {
    const loadLoyaltyAccount = async () => {
      if (!user || !storeId) {
        setLoyaltyAccount(null);
        return;
      }

      try {
        const response = await getLoyaltyAccounts();
        const accounts = Array.isArray(response.data) ? response.data : [];
        const account = accounts.find((item) => Number(item.store) === Number(storeId));
        setLoyaltyAccount(account || null);
      } catch (err) {
        console.error('Failed to load loyalty account:', err);
        setLoyaltyAccount(null);
      }
    };

    loadLoyaltyAccount();
  }, [storeId, user]);

  const reservationDisabled = store?.enable_reservation === false;
  const takeoutDisabled = store?.enable_takeout === false;

  return (
    <div className="container" style={{ marginTop: '8px', paddingTop: '8px', paddingBottom: '20px' }}>
      <div className="row mb-4">
        <div className="col-12">
          <h2 className="mb-3">
            {TEXT.welcome}{'\uff0c'}{displayName}
            {user && (
              <span className={`${styles['badge-member']} ms-2`}>
                <i className="bi bi-award me-1"></i>
                {memberLabel}
              </span>
            )}
          </h2>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-body text-center">
              <i className={`bi bi-calendar-check fs-1 ${styles['text-orange']} mb-3`}></i>
              <h3 className="card-title mb-4">{TEXT.reservationTitle}</h3>

              <div className="mb-4">
                <div className={`alert ${styles['alert-orange-light']}`}>
                  <i className="bi bi-info-circle me-2"></i>
                  {TEXT.reservationInfo}
                </div>
              </div>

              <div className="d-grid gap-2">
                <button
                  className={`btn btn-lg mb-2 ${reservationDisabled ? 'btn-secondary' : styles['btn-orange']}`}
                  onClick={() => !reservationDisabled && navigate(`/reservation/new/${storeId}`)}
                  disabled={reservationDisabled}
                  style={reservationDisabled ? { cursor: 'not-allowed', opacity: 0.5 } : {}}
                >
                  <i className="bi bi-calendar-plus me-2"></i>
                  {TEXT.reserveNow}
                </button>
              </div>

              <small className="text-muted">
                <i className="bi bi-info-circle me-1"></i>
                {user ? TEXT.memberReserveHint : TEXT.guestReserveHint}
              </small>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-body text-center">
              <i className={`bi bi-bag fs-1 ${styles['text-orange-light']} mb-3`}></i>
              <h3 className="card-title mb-4">{TEXT.takeoutTitle}</h3>

              <div className="mb-4">
                <div className={`alert ${styles['alert-orange-light']}`}>
                  <i className="bi bi-clock me-2"></i>
                  {TEXT.takeoutInfo}
                </div>
              </div>

              <div className="d-grid gap-2">
                <button
                  className={`btn btn-lg mb-2 ${takeoutDisabled ? 'btn-secondary' : styles['btn-orange-gradient']}`}
                  onClick={() => !takeoutDisabled && navigate(`/store/${storeId}/takeout`)}
                  disabled={takeoutDisabled}
                  style={takeoutDisabled ? { cursor: 'not-allowed', opacity: 0.5 } : {}}
                >
                  <i className="bi bi-arrow-right-circle me-2"></i>
                  {TEXT.orderNow}
                </button>
              </div>

              <small className="text-muted">
                <i className="bi bi-info-circle me-1"></i>
                {takeoutDisabled ? TEXT.takeoutDisabled : TEXT.takeoutHint}
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StoreBrowse;
