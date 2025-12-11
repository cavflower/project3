import React, { useState, useEffect } from 'react';
import { surplusFoodApi } from '../../api/surplusFoodApi';

const SurplusOrderList = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all'); // 'all', 'dine_in', 'takeout'

  useEffect(() => {
    loadOrders();
  }, [statusFilter, channelFilter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (channelFilter !== 'all') params.order_type = channelFilter;
      const data = await surplusFoodApi.getOrders(params);
      setOrders(data);
    } catch (error) {
      console.error('載入訂單失敗:', error);
      alert('載入訂單失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId, action) => {
    // 定義狀態映射
    const statusMap = {
      'confirm': 'confirmed',
      'ready': 'ready',
      'complete': 'completed',
      'cancel': 'cancelled',
      'reject': 'cancelled'
    };
    
    const newStatus = statusMap[action];
    
    // 樂觀更新：先更新 UI
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === orderId 
          ? { ...order, status: newStatus, status_display: getStatusLabel(newStatus) }
          : order
      )
    );

    try {
      if (action === 'confirm') {
        await surplusFoodApi.confirmOrder(orderId);
      } else if (action === 'ready') {
        await surplusFoodApi.readyOrder(orderId);
      } else if (action === 'complete') {
        await surplusFoodApi.completeOrder(orderId);
      } else if (action === 'cancel') {
        await surplusFoodApi.cancelOrder(orderId);
      } else if (action === 'reject') {
        await surplusFoodApi.rejectOrder(orderId);
      }
    } catch (error) {
      console.error('更新失敗:', error);
      alert('更新失敗');
      // 如果失敗，重新載入正確的資料
      loadOrders();
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      'pending': '待確認',
      'confirmed': '已確認',
      'ready': '可取餐',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return labels[status] || status;
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('確定要刪除此訂單嗎？')) {
      return;
    }
    
    // 樂觀更新：先從 UI 移除
    setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
    
    try {
      await surplusFoodApi.deleteOrder(orderId);
    } catch (error) {
      console.error('刪除失敗:', error);
      alert('刪除失敗');
      // 如果失敗，重新載入正確的資料
      loadOrders();
    }
  };

  return (
    <div className="tab-content">
      <div className="content-header">
        <h2>惜福食品訂單</h2>
      </div>

      {/* 狀態篩選器 */}
      <div className="filter-section" style={{ marginBottom: '20px' }}>
        <button
          className={statusFilter === 'all' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setStatusFilter('all')}
        >
          全部
        </button>
        <button
          className={statusFilter === 'pending' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setStatusFilter('pending')}
        >
          待處理
        </button>
        <button
          className={statusFilter === 'confirmed' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setStatusFilter('confirmed')}
        >
          已接受
        </button>
        <button
          className={statusFilter === 'ready' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setStatusFilter('ready')}
        >
          可取餐
        </button>
        <button
          className={statusFilter === 'completed' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setStatusFilter('completed')}
        >
          已完成
        </button>
        <button
          className={statusFilter === 'cancelled' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setStatusFilter('cancelled')}
        >
          已拒絕
        </button>
      </div>

      {/* 內用/外帶篩選器 */}
      <div className="filter-section" style={{ marginBottom: '20px' }}>
        <button
          className={channelFilter === 'all' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setChannelFilter('all')}
        >
          全部
        </button>
        <button
          className={channelFilter === 'dine_in' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setChannelFilter('dine_in')}
        >
          內用
        </button>
        <button
          className={channelFilter === 'takeout' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setChannelFilter('takeout')}
        >
          外帶
        </button>
      </div>

      {loading ? (
        <div className="loading">載入中...</div>
      ) : (
        <div className="orders-list">
          {orders.length === 0 ? (
            <div className="empty-state">目前沒有訂單</div>
          ) : (
            orders.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onUpdateStatus={handleUpdateStatus}
                onDeleteOrder={handleDeleteOrder}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const OrderCard = ({ order, onUpdateStatus, onDeleteOrder }) => {
  const statusLabels = {
    pending: '待處理',
    confirmed: '已接受',
    ready: '可取餐',
    completed: '已完成',
    cancelled: '已拒絕',
  };

  // 從 order_type 取得訂單類型
  const getOrderType = () => {
    if (order.order_type === 'dine_in') return '內用';
    if (order.order_type === 'takeout') return '外帶';
    return order.order_type_display || '外帶';
  };

  // 格式化取餐時間
  const formatPickupTime = (pickupTime) => {
    if (!pickupTime) return null;
    const date = new Date(pickupTime);
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="order-card">
      <div className="order-body">
        <div className="order-info">
          <p><strong>取餐號碼：</strong>{order.pickup_number || '待生成'}</p>
          <p><strong>客戶：</strong>{order.customer_name}</p>
          <p><strong>電話：</strong>{order.customer_phone}</p>
          <p><strong>訂單類型：</strong>{getOrderType()}</p>
          {order.order_type === 'dine_in' && order.table_label && (
            <p><strong>桌號：</strong>{order.table_label}</p>
          )}
          <p><strong>訂單狀態：</strong>{statusLabels[order.status] || order.status_display}</p>
          <p><strong>付款方式：</strong>{order.payment_method_display}</p>
          <p><strong>備註：</strong>{order.notes || '—'}</p>
          <p><strong>餐具需求：</strong>{order.use_utensils ? '需要餐具' : '不需要餐具'}</p>
          {order.pickup_time && order.order_type === 'takeout' && (
            <p><strong>取餐時間：</strong>{formatPickupTime(order.pickup_time)}</p>
          )}
          <div className="mt-2">
            <strong>品項：</strong>
            <ul className="mb-0">
              {order.items && order.items.length > 0 ? (
                order.items.map((item, index) => (
                  <li key={index}>
                    {item.surplus_food_title || item.surplus_food_detail?.title} × {item.quantity}
                  </li>
                ))
              ) : (
                // 向後兼容：舊格式單一品項
                order.surplus_food_detail && (
                  <li>{order.surplus_food_detail.title} × {order.quantity || 1}</li>
                )
              )}
            </ul>
          </div>
        </div>
      </div>
      <div className="order-actions">
        {order.status === 'pending' && (
          <>
            <button 
              className="surplus-btn-sm btn-success" 
              onClick={() => onUpdateStatus(order.id, 'confirm')}
            >
              確認訂單
            </button>
            <button 
              className="surplus-btn-sm btn-danger" 
              onClick={() => onUpdateStatus(order.id, 'reject')}
            >
              拒絕
            </button>
          </>
        )}
        {order.status === 'confirmed' && (
          <>
            <button 
              className="surplus-btn-sm surplus-btn-primary" 
              onClick={() => onUpdateStatus(order.id, 'ready')}
            >
              可取餐
            </button>
            <button 
              className="surplus-btn-sm btn-danger" 
              onClick={() => onUpdateStatus(order.id, 'cancel')}
            >
              取消
            </button>
          </>
        )}
        {order.status === 'ready' && (
          <button 
            className="surplus-btn-sm btn-success" 
            onClick={() => onUpdateStatus(order.id, 'complete')}
          >
            完成訂單
          </button>
        )}
        {(order.status === 'completed' || order.status === 'cancelled') && (
          <button 
            className="surplus-btn-sm btn-danger" 
            onClick={() => onDeleteOrder(order.id)}
          >
            刪除
          </button>
        )}
      </div>
    </div>
  );
};

export default SurplusOrderList;
