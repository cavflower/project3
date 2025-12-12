import React from 'react';
import { useParams, Link } from 'react-router-dom';

function OrderPage() {
  let { storeId } = useParams();

  return (
    <div>
      <h1>{storeId} - 點餐主頁面</h1> {/* [cite: 9] */}
      
      {/* [cite: 12] 熱銷排行(產品) */}
      <h2>產品熱銷排行</h2>
      <ul>
        <li>熱銷第一名 (推薦指數 95%)</li>
      </ul>

      {/* [cite: 12] 一般產品 */}
      <h2>菜單</h2>
      <ul>
        <li>一般產品A <button>+ 加入購物車</button></li>
        <li>一般產品B <button>+ 加入購物車</button></li>
      </ul>

      <hr />
      
      {/*  連結至線上結帳 */}
      <Link to="/checkout">
        <button>前往結帳</button>
      </Link>
    </div>
  );
}

export default OrderPage;