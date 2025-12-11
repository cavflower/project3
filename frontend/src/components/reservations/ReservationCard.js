import React from 'react';
import { 
  FaCalendarAlt, 
  FaClock, 
  FaUsers, 
  FaStore, 
  FaPhone,
  FaUser,
  FaEdit, 
  FaTimes,
  FaCheck,
  FaTrash,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf
} from 'react-icons/fa';
import './ReservationCard.css';

/**
 * 可重複使用的訂位資料卡片組件
 * 
 * @param {Object} reservation - 訂位資料
 * @param {string} viewMode - 顯示模式: 'customer' | 'merchant'
 * @param {Object} actions - 操作按鈕配置
 * @param {Function} actions.onEdit - 編輯回調
 * @param {Function} actions.onCancel - 取消回調
 * @param {Function} actions.onAccept - 接受回調（商家端）
 * @param {Function} actions.onComplete - 完成回調（商家端）
 * @param {Function} actions.onDelete - 刪除回調（商家端）
 * @param {boolean} showActions - 是否顯示操作按鈕
 */
const ReservationCard = ({ 
  reservation, 
  viewMode = 'customer', 
  actions = {},
  showActions = true 
}) => {
  const {
    id,
    store_name,
    store_address,
    customer_name,
    customer_phone,
    customer_gender,
    reservation_date,  // 後端使用 reservation_date
    time_slot,
    party_size,
    children_count = 0,
    status,
    special_requests,
    cancel_reason,
    created_at
  } = reservation;

  // 相容前端舊欄位名 date
  const displayDate = reservation_date || reservation.date;

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { icon: <FaHourglassHalf />, label: '待確認', className: 'status-pending' },
      confirmed: { icon: <FaCheckCircle />, label: '已確認', className: 'status-confirmed' },
      cancelled: { icon: <FaTimesCircle />, label: '已取消', className: 'status-cancelled' },
      completed: { icon: <FaCheckCircle />, label: '已完成', className: 'status-completed' },
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`status-badge ${config.className}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
    return date.toLocaleDateString('zh-TW', options);
  };

  const formatCreatedAt = (dateString) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `預訂於 ${month}/${day} 上午${hours}:${minutes}`;
  };

  const getCustomerTitle = (gender) => {
    if (gender === 'male') return '先生';
    if (gender === 'female') return '小姐';
    return ''; // 其他情況不加稱謂
  };

  const totalGuests = party_size + children_count;

  return (
    <div className="reservation-card">
      {/* 卡片頭部 */}
      <div className="card-header">
        <div className="header-left">
          {viewMode === 'customer' && store_name && (
            <div className="store-info">
              <FaStore className="store-icon" />
              <div>
                <h3>{store_name}</h3>
                {store_address && <p className="store-address">{store_address}</p>}
              </div>
            </div>
          )}
          {viewMode === 'merchant' && customer_name && (
            <div className="customer-info">
              <FaUser className="customer-icon" />
              <div>
                <h3>{customer_name}{getCustomerTitle(customer_gender)}</h3>
                {created_at && <p className="created-time">{formatCreatedAt(created_at)}</p>}
              </div>
            </div>
          )}
        </div>
        {getStatusBadge(status)}
      </div>

      {/* 卡片內容 */}
      <div className="card-body">
        {/* 聯絡電話（商家端顯示） */}
        {viewMode === 'merchant' && customer_phone && (
          <div className="info-row">
            <FaPhone className="info-icon" />
            <span>{customer_phone}</span>
          </div>
        )}

        {/* 日期 */}
        <div className="info-row">
          <FaCalendarAlt className="info-icon" />
          <span>{formatDate(displayDate)}</span>
        </div>

        {/* 時段 */}
        <div className="info-row">
          <FaClock className="info-icon" />
          <span>{time_slot}</span>
        </div>

        {/* 人數 */}
        <div className="info-row">
          <FaUsers className="info-icon" />
          <span>
            {party_size} 位大人
            {children_count > 0 && ` + ${children_count} 位小孩`}
            {totalGuests > party_size && ` （共 ${totalGuests} 位）`}
            {totalGuests === party_size && children_count === 0 && ` （共 ${totalGuests} 位）`}
          </span>
        </div>

        {/* 特殊需求 */}
        {special_requests && (
          <div className="special-requests">
            <strong>特殊需求：</strong>{special_requests}
          </div>
        )}

        {/* 取消原因（僅在已取消狀態顯示） */}
        {status === 'cancelled' && cancel_reason && (
          <div className="cancel-reason">
            <strong>取消原因：</strong>{cancel_reason}
          </div>
        )}
      </div>

      {/* 操作按鈕 */}
      {showActions && (
        <div className="card-actions">
          {/* 商家端按鈕 */}
          {viewMode === 'merchant' && (
            <>
              {status === 'confirmed' && actions.onComplete && (
                <button className="btn-complete" onClick={() => actions.onComplete(id)}>
                  <FaCheck /> 完成
                </button>
              )}
              {status === 'pending' && actions.onAccept && (
                <button className="btn-accept" onClick={() => actions.onAccept(id)}>
                  <FaCheck /> 接受訂位
                </button>
              )}
              {(status === 'pending' || status === 'confirmed') && actions.onCancel && (
                <button className="btn-cancel" onClick={() => actions.onCancel(id)}>
                  <FaTimes /> 取消訂位
                </button>
              )}
              {(status === 'completed' || status === 'cancelled') && actions.onDelete && (
                <button className="btn-delete" onClick={() => actions.onDelete(id)}>
                  <FaTrash /> 刪除資料
                </button>
              )}
            </>
          )}

          {/* 顧客端按鈕 */}
          {viewMode === 'customer' && (
            <>
              {(status === 'pending' || status === 'confirmed') && actions.onEdit && (
                <button className="btn-edit" onClick={() => actions.onEdit(id)}>
                  <FaEdit /> 編輯
                </button>
              )}
              {(status === 'pending' || status === 'confirmed') && actions.onCancel && (
                <button className="btn-cancel" onClick={() => actions.onCancel(id)}>
                  <FaTimes /> 取消訂位
                </button>
              )}
              {(status === 'completed' || status === 'cancelled') && actions.onDelete && (
                <button className="btn-delete" onClick={() => actions.onDelete(id)}>
                  <FaTrash /> 刪除資料
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ReservationCard;
