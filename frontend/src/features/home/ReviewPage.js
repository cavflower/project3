import React from 'react';
import { useParams } from 'react-router-dom';

function ReviewPage() {
  let { orderId } = useParams();

  return (
    <div>
      <h1>評價訂單 {orderId}</h1> {/*  */}
      
      {/* [cite: 19] 對單項產品評分 */}
      <div>
        <h3>產品評分</h3>
        <p>一般產品A: [ 1 2 3 4 5 ] 星</p>
        <p>一般產品B: [ 1 2 3 4 5 ] 星</p>
      </div>
      
      {/* [cite: 20] 店家評論 (環境、服務...) */}
      <div>
        <h3>店家評論</h3>
        <textarea placeholder="分享您對店家的整體看法..."></textarea>
      </div>

      <button onClick={() => alert('感謝您的評論！')}>送出評論</button>
    </div>
  );
}

export default ReviewPage;