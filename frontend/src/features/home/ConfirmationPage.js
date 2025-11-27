import React from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';

function ConfirmationPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const { pickupNumber, paymentMethod } = location.state || {};

  // [cite: 16] (系統通知) - 這裡可以實作 WebSocket 或Polling 來即時更新叫號
  return (
    <div>
      <h1>訂單 {orderId} 完成！</h1>
      <h2>您的取餐號碼：{pickupNumber || '待通知'}</h2>
      <p>付款方式：{paymentMethod || '未提供'}</p>
      <p>目前叫號至：102</p>

      <hr />

      {/*  訂單完成後導向評論頁提問 */}
      <p>餐點還滿意嗎？</p>
      <Link to={`/review/${orderId}`}>
        <button>前往評論</button>
      </Link>
    </div>
  );
}

export default ConfirmationPage;
