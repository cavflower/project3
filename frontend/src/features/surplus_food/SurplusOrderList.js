import React, { useState, useEffect } from 'react';
import { surplusFoodApi } from '../../api/surplusFoodApi';

const SurplusOrderList = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await surplusFoodApi.getOrders();
      setOrders(data);
    } catch (error) {
      console.error('載入訂單失敗:', error);
      alert('載入訂單失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId, action) => {
    try {
      if (action === 'confirm') {
        await surplusFoodApi.confirmOrder(orderId);
      } else if (action === 'ready') {
        await surplusFoodApi.readyOrder(orderId);
      } else if (action === 'complete') {
        await surplusFoodApi.completeOrder(orderId);
      } else if (action === 'cancel') {
        await surplusFoodApi.cancelOrder(orderId);
      }
      alert('更新成功！');
      loadOrders();
    } catch (error) {
      console.error('更新失敗:', error);
      alert('更新失敗');
    }
  };

  return (
    <div className="tab-content">
      <div className="content-header">
        <h2>惜福食品訂單</h2>
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
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const OrderCard = ({ order, onUpdateStatus }) => {
  return (
    <div className="order-card">
      <div className="order-header">
        <span className="order-number">{order.order_number}</span>
        <span className={`status-badge status-${order.status}`}>
          {order.status_display}
        </span>
      </div>
      <div className="order-body">
        <div className="order-info">
          <p><strong>商品:</strong> {order.surplus_food_detail?.title}</p>
          <p><strong>顧客:</strong> {order.customer_name} ({order.customer_phone})</p>
          <p><strong>數量:</strong> {order.quantity}</p>
          <p><strong>總價:</strong> NT$ {order.total_price}</p>
          <p><strong>付款方式:</strong> {order.payment_method_display}</p>
        </div>
      </div>
      <div className="order-actions">
        {order.status === 'pending' && (
          <button 
            className="surplus-btn-sm btn-success" 
            onClick={() => onUpdateStatus(order.id, 'confirm')}
          >
            確認訂單
          </button>
        )}
        {order.status === 'confirmed' && (
          <button 
            className="surplus-btn-sm surplus-btn-primary" 
            onClick={() => onUpdateStatus(order.id, 'ready')}
          >
            可取餐
          </button>
        )}
        {order.status === 'ready' && (
          <button 
            className="surplus-btn-sm btn-success" 
            onClick={() => onUpdateStatus(order.id, 'complete')}
          >
            完成
          </button>
        )}
        {(order.status === 'pending' || order.status === 'confirmed') && (
          <button 
            className="surplus-btn-sm btn-danger" 
            onClick={() => onUpdateStatus(order.id, 'cancel')}
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
};

export default SurplusOrderList;
