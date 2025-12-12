import React from 'react';
import { useNavigate } from 'react-router-dom'; // useNavigate 用於程式化跳轉

function CheckoutPage() {
  let navigate = useNavigate();

  function handleCheckout() {
    // 這裡會執行結帳邏輯 (呼叫後端 API...)
    // ...
    // 假設結帳成功，取得訂單ID
    const orderId = 'order-123';
    
    // [cite: 15] 結帳成功後，跳轉到取餐叫號頁面
    navigate(`/confirmation/${orderId}`);
  }

  return (
    <div>
      <h1>線上結帳</h1> {/*  */}
      <p>您的餐點總計: $500</p>
      
      {/*  (3.2兌換商品/抵點) */}
      <div>
        <input type="text" placeholder="輸入點數折抵" />
      </div>
      
      <button onClick={handleCheckout}>確認付款</button>
    </div>
  );
}

export default CheckoutPage;
