import React, { useState } from 'react';
// 1. 將 react-router-dom 的 imports 合併
import { Routes, Route, Navigate } from 'react-router-dom';

// 佈局元件
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import Sidebar from './components/layout/Sidebar';

// 頁面元件
import HomePage from './features/home/HomePage';
// import LoginPage from './features/authentication/LoginPage';
// import RegisterPage from './features/authentication/RegisterPage';
import CustomerLoginPage from './features/authentication/CustomerLoginPage';
import MerchantLoginPage from './features/authentication/MerchantLoginPage';
import CustomerRegisterPage from './features/authentication/CustomerRegisterPage';
import MerchantRegisterPage from './features/authentication/MerchantRegisterPage';
import RestaurantMemberLoginPage from './features/authentication/RestaurantMemberLoginPage';
import AdminLoginPage from './features/admin/AdminLoginPage';
import AdminDashboard from './features/admin/AdminDashboard';
import CustomerHomePage from './features/home/CustomerHomePage';
import MerchantDashboard from './features/merchant_dashboard/MerchantDashboard';
import ProfilePage from './features/user_profile/ProfilePage'; // 1. 匯入新的個人資料頁面
import ProductManagementPage from './features/merchant_dashboard/product_management/ProductManagementPage';
import PlanSelectionPage from './features/plan_selection/PlanSelectionPage'; // 匯入方案選擇頁面
import StoreSettingsPage from './features/merchant_dashboard/store_settings/StoreSettingsPage'; // 匯入餐廳設定頁面
import ReservationManagementPage from './features/merchant_dashboard/reservation_management/ReservationManagementPage'; // 匯入訂位管理頁面
import InventoryManagementPage from './features/merchant_dashboard/inventory_management/InventoryManagementPage'; // 匯入原物料管理頁面
import ReservationPage from './features/reservations/ReservationPage'; // 導入顧客訂位頁面
import ReservationSuccessPage from './features/reservations/ReservationSuccessPage'; // 導入訂位成功頁面
import MyReservationsPage from './features/reservations/MyReservationsPage'; // 導入我的訂位頁面
import EditReservationPage from './features/reservations/EditReservationPage'; // 導入編輯訂位頁面
import GuestReservationLookup from './features/reservations/GuestReservationLookup'; // 導入訪客查詢頁面
import ScheduleManagementPage from './features/merchant_dashboard/schedule_management/ScheduleManagementPage';
import StoreBrowse from './features/home/StoreBrowse';
import StorePage from './features/home/StorePage';
import ConfirmationPage from './features/checkout/ConfirmationPage';
import ReviewPage from './features/checkout/ReviewPage';
import LoyaltyManagement from './features/loyalty_management/LoyaltyManagement';
import CustomerLoyalty from './features/customer_loyalty/CustomerLoyalty';
import RedemptionCatalog from './features/customer_loyalty/RedemptionCatalog';
import MyRedemptions from './features/customer_loyalty/MyRedemptions';
import PointsHistory from './features/customer_loyalty/PointsHistory';
import TakeoutOrderPage from './features/takeout/TakeoutOrderPage';
import TakeoutCartPage from './features/takeout/TakeoutCartPage';
import SurplusZonePage from './features/takeout/SurplusZonePage';
import DineInOrderPage from './features/dine_in/DineInOrderPage';
import DineInCartPage from './features/dine_in/DineInCartPage';
import DineInSettingsPage from './features/merchant_dashboard/dine_in/DineInSettingsPage';
import SurplusFoodManagement from './features/surplus_food/SurplusFoodManagement';
import OrderManagementPage from './features/merchant_dashboard/order_management/OrderManagementPage';
import FinancialReportPage from './features/merchant_dashboard/financial_report/FinancialReportPage';
import LineBotFAQManagement from './features/line_bot/LineBotFAQManagement';
import LineBotSettings from './components/merchant/linebot/LineBotSettings';


// Context
import { useAuth } from './store/AuthContext'; 

/**
 * 受保護路由元件
 * 檢查使用者是否登入，若未登入則導向到 /login
 */
function ProtectedRoute({ children }) {
  const { isLoggedIn, loading } = useAuth(); // 確保 AuthContext 有回傳 loading

  if (loading) {
    // 在驗證還在載入時不要重定向，改顯示空或 spinner
    return null; 
  }

  if (!isLoggedIn) {
    return <Navigate to="/login/customer" replace />;
  }
  return children;
}

function App() {
  // Sidebar 狀態
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  return (
    // 2. 必須用 <BrowserRouter> 包裹整個應用程式
    
      <div className="App">
        <Navbar toggleSidebar={toggleSidebar} />
        <Sidebar isOpen={isSidebarOpen} />
        <div className={`main-content ${isSidebarOpen ? 'sidebar-open' : ''}`}>
          <main>
            {/* 3. 路由配置 */}
            <Routes>
              
              {/* 首頁 (/)：公開 */}
              <Route path="/" element={<HomePage />} />
              
              {/* 登入頁 */}
              <Route path="/login/customer" element={<CustomerLoginPage />} />
              <Route path="/login/merchant" element={<MerchantLoginPage />} />
              <Route path="/login/restaurant-member" element={<RestaurantMemberLoginPage />} />
              <Route path="/login/admin" element={<AdminLoginPage />} />
              {/* 為了向後相容，將 /login 導向顧客登入 */}
              <Route path="/login" element={<Navigate to="/login/customer" />} />


              {/* 註冊頁 */}
              <Route path="/register/customer" element={<CustomerRegisterPage />} />
              <Route path="/register/merchant" element={<MerchantRegisterPage />} />
              <Route path="/register" element={<Navigate to="/register/customer" />} />

              {/* 管理員儀表板 */}
              <Route path="/admin/dashboard" element={<AdminDashboard />} />

              {/* 顧客首頁 (/customer-home)：受保護 */}
              <Route 
                path="/customer-home"
                element={
                    <CustomerHomePage />  
                }
              />

              <Route
                path="/store/:storeId/options"
                element={<StoreBrowse />}
              />
          {/* 點入特定店家 頁面 */}
              <Route path="/store/:storeId" element={<StorePage />} />
          {/* 點餐主頁面 */}
          
          {/* 外帶點餐 頁面 */}
              <Route path="/store/:storeId/takeout" element={<TakeoutOrderPage />} />
          {/* 惜福專區 頁面 */}
              <Route path="/store/:storeId/surplus" element={<SurplusZonePage />} />
          {/* 外帶購物車結帳 頁面 */}
              <Route path="/takeout/:storeId/cart" element={<TakeoutCartPage />} />
          {/* 內用菜單（QR code 導向） */}
              <Route path="/store/:storeId/dine-in/menu" element={<DineInOrderPage />} />
          {/* 內用購物車結帳 頁面 */}
              <Route path="/dinein/:storeId/cart" element={<DineInCartPage />} />

          {/* 線上結帳 頁面 */}
          
          {/* 訂單確認 頁面 */}
              <Route path="/confirmation/:orderId" element={<ConfirmationPage />} />
          
          {/* 評價頁面 */}
              <Route path="/review/:orderId" element={<ReviewPage />} />
          
          {/* 顧客訂位流程 */}
              <Route path="/reservation/new/:storeId" element={<ReservationPage />} />
              <Route path="/reservation/success" element={<ReservationSuccessPage />} />
              <Route path="/reservation/edit/:reservationId" element={<EditReservationPage />} />
              
              {/* 訪客查詢訂位 */}
              <Route path="/guest-lookup" element={<GuestReservationLookup />} />
              
              {/* 我的訂位頁面（訪客也可查看）*/}
              <Route path="/my-reservations" element={<MyReservationsPage />} />
              
              {/* 內用設定 */}
              <Route path="/merchant/dine-in" element={<ProtectedRoute><DineInSettingsPage /></ProtectedRoute>}
/>


              {/* 店家儀表板 (/dashboard)：受保護 */}
              <Route 
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <MerchantDashboard />
                  </ProtectedRoute>
                }
              />

              <Route 
                path="/merchant/products"
                element={
                  <ProtectedRoute>
                    <ProductManagementPage />
                  </ProtectedRoute>
                }
              />

              {/* 訂位管理頁面路由 */}
              <Route
                path="/merchant/reservations"
                element={
                  <ProtectedRoute>
                    <ReservationManagementPage />
                  </ProtectedRoute>
                }
              />
              
              {/* 原物料管理頁面路由 */}
              <Route
                path="/merchant/inventory"
                element={
                  <ProtectedRoute>
                    <InventoryManagementPage />
                  </ProtectedRoute>
                }
              />
              
              {/* 財務報表頁面路由 */}
              <Route
                path="/merchant/reports"
                element={
                  <ProtectedRoute>
                    <FinancialReportPage />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/merchant/orders"
                element={
                  <ProtectedRoute>
                    <OrderManagementPage />
                  </ProtectedRoute>
                }
              />
              {/* 餐廳設定頁面路由 */}
              <Route
                path="/merchant/settings"
                element={
                  <ProtectedRoute>
                    <StoreSettingsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/merchant/schedule"
                element={
                  <ProtectedRoute>
                    <ScheduleManagementPage />
                  </ProtectedRoute>
                }
              />

              {/* LINE BOT FAQ 管理 */}
              <Route
                path="/merchant/line-bot/faq"
                element={
                  <ProtectedRoute>
                    <LineBotFAQManagement />
                  </ProtectedRoute>
                }
              />

              {/* LINE BOT 設定頁面 */}
              <Route
                path="/merchant/line-bot"
                element={
                  <ProtectedRoute>
                    <LineBotSettings />
                  </ProtectedRoute>
                }
              />

              {/* 新增方案選擇頁面路由 */}
              <Route
                path="/select-plan"
                element={
                  <ProtectedRoute>
                    <PlanSelectionPage />
                  </ProtectedRoute>
                }
              />

              {/* 個人資料頁 (/profile)：受保護 */}
              <Route 
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* 會員制度管理頁面路由（商家端） */}
              <Route
                path="/merchant/loyalty"
                element={
                  <ProtectedRoute>
                    <LoyaltyManagement />
                  </ProtectedRoute>
                }
              />

              {/* 惜福食品管理頁面路由（商家端） */}
              <Route
                path="/merchant/surplus-food"
                element={
                  <ProtectedRoute>
                    <SurplusFoodManagement />
                  </ProtectedRoute>
                }
              />

              {/* 顧客會員中心路由 */}
              {/* 綜合會員中心 - 所有商家 */}
              <Route
                path="/customer/loyalty"
                element={
                  <ProtectedRoute>
                    <CustomerLoyalty />
                  </ProtectedRoute>
                }
              />
              {/* 店家專屬會員中心 */}
              <Route
                path="/customer/loyalty/:storeId"
                element={
                  <ProtectedRoute>
                    <CustomerLoyalty />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer/loyalty/redemptions"
                element={
                  <ProtectedRoute>
                    <RedemptionCatalog />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer/loyalty/my-redemptions"
                element={
                  <ProtectedRoute>
                    <MyRedemptions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer/loyalty/history"
                element={
                  <ProtectedRoute>
                    <PointsHistory />
                  </ProtectedRoute>
                }
              />

            </Routes>
          </main>
          <Footer />
        </div>
      </div>
    
  );
}

export default App;
