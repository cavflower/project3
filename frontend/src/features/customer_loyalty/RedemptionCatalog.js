import React, { useState, useEffect } from 'react';
import { getRedemptionProducts, getLoyaltyAccounts, createRedemption } from '../../api/loyaltyApi';
import { FaGift, FaCheck, FaTimes } from 'react-icons/fa';
import './RedemptionCatalog.css';

const RedemptionCatalog = () => {
  const [products, setProducts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedStore, setSelectedStore] = useState('all');
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, accountsRes] = await Promise.all([
        getRedemptionProducts(),
        getLoyaltyAccounts()
      ]);
      setProducts(productsRes.data);
      setAccounts(accountsRes.data);
    } catch (error) {
      console.error('獲取資料失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAccountByStore = (storeId) => {
    return accounts.find(acc => acc.store === storeId);
  };

  const handleRedeemClick = (product) => {
    setSelectedProduct(product);
    setShowConfirm(true);
  };

  const confirmRedeem = async () => {
    if (!selectedProduct) return;

    setRedeeming(selectedProduct.id);
    try {
      await createRedemption(selectedProduct.id);
      alert('兌換成功！請至「我的兌換」查看兌換碼');
      setShowConfirm(false);
      fetchData(); // 重新載入資料
    } catch (error) {
      const message = error.response?.data?.product?.[0] || '兌換失敗';
      alert(message);
    } finally {
      setRedeeming(null);
    }
  };

  const filteredProducts = selectedStore === 'all' 
    ? products 
    : products.filter(p => p.store === parseInt(selectedStore));

  if (loading) {
    return <div className="loading">載入中...</div>;
  }

  return (
    <div className="redemption-catalog">
      <div className="catalog-header">
        <h1><FaGift /> 兌換商品</h1>
        <p>使用您的點數兌換心儀商品</p>
      </div>

      {accounts.length > 0 && (
        <div className="filter-bar">
          <label>篩選商家：</label>
          <select 
            value={selectedStore} 
            onChange={(e) => setSelectedStore(e.target.value)}
          >
            <option value="all">所有商家</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.store}>
                {acc.store_name} ({acc.available_points} 點)
              </option>
            ))}
          </select>
        </div>
      )}

      {filteredProducts.length === 0 ? (
        <div className="no-products">
          <FaGift size={60} />
          <p>目前沒有可兌換的商品</p>
        </div>
      ) : (
        <div className="products-grid">
          {filteredProducts.map((product) => {
            const account = getAccountByStore(product.store);
            const canAfford = account && account.available_points >= product.required_points;
            const hasStock = product.inventory === null || product.inventory > 0;

            return (
              <div key={product.id} className="product-card">
                <div className="product-header">
                  <h3>{product.title}</h3>
                  <span className="points-badge">
                    {product.required_points} 點
                  </span>
                </div>

                <p className="product-description">{product.description}</p>

                <div className="product-footer">
                  {product.inventory !== null && (
                    <span className={`stock ${product.inventory === 0 ? 'out' : ''}`}>
                      庫存: {product.inventory}
                    </span>
                  )}

                  {account ? (
                    <button
                      className={`redeem-btn ${!canAfford || !hasStock ? 'disabled' : ''}`}
                      onClick={() => handleRedeemClick(product)}
                      disabled={!canAfford || !hasStock || redeeming === product.id}
                    >
                      {redeeming === product.id ? '兌換中...' : 
                       !hasStock ? '已售完' :
                       !canAfford ? '點數不足' : '兌換'}
                    </button>
                  ) : (
                    <span className="no-account">需先成為會員</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showConfirm && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h2>確認兌換</h2>
            <div className="confirm-details">
              <p><strong>商品：</strong>{selectedProduct.title}</p>
              <p><strong>所需點數：</strong>{selectedProduct.required_points} 點</p>
              <p className="warning">兌換後點數將立即扣除，確定要兌換嗎？</p>
            </div>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setShowConfirm(false)}>
                <FaTimes /> 取消
              </button>
              <button className="btn-confirm" onClick={confirmRedeem}>
                <FaCheck /> 確認兌換
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RedemptionCatalog;
