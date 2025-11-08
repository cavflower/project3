import React from 'react';
import { useParams, Link } from 'react-router-dom';

function ConfirmationPage() {
  let { orderId } = useParams();

  // [cite: 16] (系統通知) - 這裡可以實作 WebSocket 或 Polling 來即時更新叫號
  
  return (
    <div>
      <h1>訂單 {orderId} 完成！</h1>
      <h2>您的取餐號碼：105</h2> {/* [cite: 15] */}
      <p>目前叫號至：102</p>

      <hr />
      
      {/*  訂單完成後，提供評論連結 */}
      <p>餐點還滿意嗎？</p>
      <Link to={`/review/${orderId}`}>
        <button>前往評論</button>
      </Link>
    </div>
  );
}

export default ConfirmationPage;
