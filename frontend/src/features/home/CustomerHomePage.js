import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPublishedStores } from '../../api/storeApi';

const categories = [
  { id: 'all', name: '全部', icon: 'grid' },
  { id: 'chinese', name: '中式料理', icon: 'cup-hot' },
  { id: 'japanese', name: '日本料理', icon: 'egg-fried' },
  { id: 'drinks', name: '飲料', icon: 'cup-straw' },
  { id: 'dessert', name: '甜點', icon: 'cake2' },
  { id: 'western', name: '西式料理', icon: 'egg' },
];

function CustomerHomePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      setLoading(true);
      const response = await getPublishedStores();
      // 轉換 API 資料格式
      const formattedStores = response.data.map(store => ({
        id: store.id,
        name: store.name,
        description: store.description || '',
        address: store.address || '',
        phone: store.phone || '',
        rating: 4.5, // 暫時使用預設值，之後可以從評論系統獲取
        imageUrl: store.images && store.images.length > 0 
          ? (store.images[0].image.startsWith('http') 
              ? store.images[0].image 
              : `http://127.0.0.1:8000${store.images[0].image}`)
          : '/images/default-store.jpg',
        tags: store.description ? [store.description.substring(0, 20)] : [],
        is_open: store.is_open,
      }));
      setStores(formattedStores);
    } catch (err) {
      console.error('Failed to load stores:', err);
      setStores([]);
    } finally {
      setLoading(false);
    }
  };
  
  // 篩選店家
  const filteredStores = stores.filter(store => {
    const matchesSearch = store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         store.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         store.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    // 暫時不根據分類篩選，因為 API 沒有分類欄位
    return matchesSearch;
  });

  return (
    <div className="container" style={{ marginTop: '70px' }}>
      {/* 搜尋區 */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="input-group">
                <span className="input-group-text">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control form-control-lg"
                  placeholder="搜尋店家名稱或料理類型..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 分類選擇 */}
      <div className="row g-3 mb-4">
        {categories.map(category => (
          <div key={category.id} className="col-4 col-md-2">
            <button
              className={`btn btn-outline-primary w-100 h-100 d-flex flex-column align-items-center justify-content-center py-3 ${
                selectedCategory === category.id ? 'active' : ''
              }`}
              onClick={() => setSelectedCategory(category.id)}
            >
              <i className={`bi bi-${category.icon} fs-4 mb-2`}></i>
              <span className="text-wrap text-center small">{category.name}</span>
            </button>
          </div>
        ))}
      </div>

      {/* 載入中 */}
      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">載入中...</span>
          </div>
          <p className="mt-3">載入店家資訊中...</p>
        </div>
      )}

      {/* 店家列表 */}
      {!loading && (
      <div className="row g-4">
        {filteredStores.map(store => (
          <div key={store.id} className="col-md-6 col-lg-4">
            <Link 
              to={`/store/${store.id}`} 
              className="text-decoration-none text-dark"
            >
              <div className="card h-100 shadow-sm hover-lift">
                <div className="card-img-top img-fluid" style={{
                  height: '200px',
                  backgroundImage: `url(${store.imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}>
                  {/* 可以加入促銷標籤等 */}
                </div>
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <h5 className="card-title mb-0">{store.name}</h5>
                    <span className="badge bg-warning">
                      <i className="bi bi-star-fill me-1"></i>
                      {store.rating}
                    </span>
                  </div>
                  <div className="mb-2">
                    {store.tags.map((tag, index) => (
                      <span key={index} className="badge bg-light text-dark me-1">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="card-footer bg-white">
                  <div className="d-flex justify-content-between align-items-center">
                    <small className="text-muted">
                      <i className="bi bi-clock me-1"></i>
                      {store.is_open ? '營業中' : '休息中'}
                    </small>
                    <button className="btn btn-sm btn-outline-primary">
                      立即訂購
                      <i className="bi bi-arrow-right ms-1"></i>
                    </button>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
      )}

      {/* 無結果提示 */}
      {!loading && filteredStores.length === 0 && (
        <div className="text-center py-5">
          <i className="bi bi-search display-1 text-muted"></i>
          <p className="lead mt-3">找不到符合條件的店家</p>
          <button 
            className="btn btn-outline-primary"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('all');
            }}
          >
            重設搜尋條件
          </button>
        </div>
      )}
    </div>
  );
}

export default CustomerHomePage;