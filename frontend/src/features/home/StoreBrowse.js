import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { Link, useNavigate, useParams } from 'react-router-dom';

function StoreBrowse() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { storeId } = useParams();
  const [selectedSeats, setSelectedSeats] = useState(1);
  
  // 可選擇的座位數量選項
  const seatOptions = [1, 2, 3, 4, 5, 6, 7, 8];

  // 處理訂位人數變更
  const handleSeatChange = (event) => {
    setSelectedSeats(parseInt(event.target.value));
  };

  return (
    <div className="container" style={{ marginTop: '70px', paddingTop: '20px', paddingBottom: '20px' }}>
      <div className="row mb-4">
        <div className="col-12">
          <h2 className="mb-3">歡迎光臨，{user?.name || '顧客'}
            <span className="badge bg-warning text-dark ms-2">
              <i className="bi bi-award me-1"></i>
              鉑金會員
            </span>
          </h2>
        </div>
      </div>

      <div className="row g-4">
        {/* 線上訂位選項 */}
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-body text-center">
              <i className="bi bi-calendar-check fs-1 text-primary mb-3"></i>
              <h3 className="card-title mb-4">線上訂位</h3>
              
              <div className="mb-4">
                <div className="alert alert-info">
                  <i className="bi bi-info-circle me-2"></i>
                  提前預訂，享受無縫用餐體驗
                </div>
              </div>

              <div className="d-grid gap-2">
                <button 
                  className="btn btn-primary btn-lg mb-2"
                  onClick={() => navigate(`/reservation/new/${storeId}`)}
                >
                  <i className="bi bi-calendar-plus me-2"></i>
                  立即訂位
                </button>
              </div>

              <small className="text-muted">
                <i className="bi bi-info-circle me-1"></i>
                {user ? '會員快速訂位，無需填寫資料' : '訪客訂位需填寫聯絡資訊'}
              </small>
            </div>
          </div>
        </div>

        {/* 外帶選項 */}
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-body text-center">
              <i className="bi bi-bag fs-1 text-success mb-3"></i>
              <h3 className="card-title mb-4">外帶自取</h3>
              
              <div className="mb-4">
                <div className="alert alert-info">
                  <i className="bi bi-clock me-2"></i>
                  預計取餐時間：20-30 分鐘
                </div>
              </div>

              <div className="d-grid gap-2">
                <button 
                  className="btn btn-success btn-lg mb-2"
                  onClick={() => navigate('/takeout-order')}
                >
                  <i className="bi bi-arrow-right-circle me-2"></i>
                  立即點餐
                </button>
              </div>

              <small className="text-muted">
                <i className="bi bi-info-circle me-1"></i>
                可線上付款，到店直接取餐
              </small>
            </div>
          </div>
        </div>

        {/* 系統通知區 */}
        <div className="col-12">
          <div className="card">
            <div className="card-header bg-light">
              <h5 className="mb-0">
                <i className="bi bi-bell me-2"></i>
                系統通知
              </h5>
            </div>
            <div className="card-body">
              <div className="alert alert-warning mb-0">
                <i className="bi bi-exclamation-triangle me-2"></i>
                您有一筆訂單正在製作中 (訂單編號: #123456)
                <button className="btn btn-sm btn-outline-warning ms-3">
                  查看詳情
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default StoreBrowse;