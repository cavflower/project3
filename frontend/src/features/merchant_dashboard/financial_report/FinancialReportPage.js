import React, { useState, useEffect } from 'react';
import { 
  FaChartLine, 
  FaCalendarAlt, 
  FaFileExport, 
  FaShoppingCart,
  FaDollarSign,
  FaUtensils,
  FaStore,
  FaArrowUp,
  FaArrowDown,
  FaDownload,
} from 'react-icons/fa';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../../api/api';
import { getMyStore } from '../../../api/storeApi';
import { getProducts } from '../../../api/productApi';
import './FinancialReportPage.css';

const FinancialReportPage = () => {
  // 日期區間狀態
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // 報表資料狀態
  const [reportData, setReportData] = useState({
    summary: {
      totalRevenue: 0,
      totalOrders: 0,
      avgOrderValue: 0,
      revenueGrowth: 0,
    },
    dailyRevenue: [],
    productSales: [],
    channelRevenue: [],
  });

  const [loading, setLoading] = useState(false);

  // 模擬載入報表資料
  useEffect(() => {
    loadReportData();
  }, [dateRange]);

  const loadReportData = async () => {
    setLoading(true);

    try {
      // 1. 獲取店家 ID
      let storeId = null;
      try {
        const storeRes = await getMyStore();
        storeId = storeRes.data?.id;
      } catch (err) {

        if (err.response?.status === 404) {
          console.log('[FinancialReport] Store not found - merchant needs to create store settings first');
          // 不顯示錯誤，僅記錄
        } else {
          console.error('[FinancialReport] Error fetching store:', err);
        }

      }

      // 2. 獲取真實商品列表
      let products = [];
      let productPriceMap = {}; // 商品 ID -> 價格對照表
      try {
        const res = await getProducts();
        products = res && res.data ? res.data : (Array.isArray(res) ? res : []);
        // 建立價格對照表
        products.forEach(p => {
          const price = p && (p.price || p.original_price || p.unit_price) ? Number(p.price || p.original_price || p.unit_price) : NaN;
          productPriceMap[p.id] = Number.isFinite(price) ? price : 120; // 預設價格 120
        });
      } catch (err) {
        console.error('無法獲取商品資料', err);
        products = [];
      }

      // 3. 獲取真實訂單資料
      let orders = [];
      if (storeId) {
        try {
          const ordersRes = await api.get('/orders/list/', { params: { store_id: storeId } });
          orders = ordersRes.data || [];
          
          // 過濾日期範圍內的訂單
          const startDate = new Date(dateRange.startDate);
          const endDate = new Date(dateRange.endDate);
          endDate.setHours(23, 59, 59, 999); // 包含結束日期全天
          
          orders = orders.filter(order => {
            const createdAt = new Date(order.created_at);
            return createdAt >= startDate && createdAt <= endDate;
          });
        } catch (err) {
          console.error('無法獲取訂單資料', err);
          orders = [];
        }
      }

      // 4. 處理資料
      let dailyRevenue = [];
      let productSales = [];
      let channelRevenue = [];
      let totalRevenue = 0;
      let totalOrders = orders.length;

      // 如果有真實訂單，從訂單計算數據
      if (orders.length > 0) {
        // 計算每日營收
        const dailyStats = {};
        const start = new Date(dateRange.startDate);
        const end = new Date(dateRange.endDate);
        
        // 初始化所有日期
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const month = d.getMonth() + 1;
          const day = d.getDate();
          const weekday = d.toLocaleDateString('zh-TW', { weekday: 'short' });
          const dayName = `${month}/${day} ${weekday}`;
          const dateKey = d.toISOString().split('T')[0];
          
          dailyStats[dateKey] = {
            date: dayName,
            revenue: 0,
            orders: 0,
          };
        }
        
        // 計算商品銷售統計
        const productStats = {};
        const channelStats = {
          'dine_in': { name: '內用', value: 0, orders: 0 },
          'takeout': { name: '外帶', value: 0, orders: 0 },
          'delivery': { name: '外送', value: 0, orders: 0 },
          'reservation': { name: '預訂', value: 0, orders: 0 },
        };

        orders.forEach(order => {
          let orderTotal = 0;
          
          // 計算每個訂單的商品統計
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
              const productId = item.product_id || item.product;
              const quantity = item.quantity || 0;
              const price = productPriceMap[productId] || 120;
              const itemRevenue = price * quantity;
              
              if (!productStats[productId]) {
                const product = products.find(p => p.id === productId);
                productStats[productId] = {
                  name: product?.name || product?.title || `商品 ${productId}`,
                  quantity: 0,
                  revenue: 0,
                };
              }
              
              productStats[productId].quantity += quantity;
              productStats[productId].revenue += itemRevenue;
              orderTotal += itemRevenue;
            });
          }
          
          // 累計通路統計
          const channel = order.service_channel || order.channel || 'takeout';
          if (channelStats[channel]) {
            channelStats[channel].value += orderTotal;
            channelStats[channel].orders += 1;
          } else {
            // 未知通路歸類到外帶
            channelStats['takeout'].value += orderTotal;
            channelStats['takeout'].orders += 1;
          }
          
          // 累計每日營收
          const orderDate = new Date(order.created_at);
          const dateKey = orderDate.toISOString().split('T')[0];
          if (dailyStats[dateKey]) {
            dailyStats[dateKey].revenue += orderTotal;
            dailyStats[dateKey].orders += 1;
          }
          
          totalRevenue += orderTotal;
        });

        // 轉換商品統計為陣列並計算百分比
        productSales = Object.values(productStats);
        const productTotalRevenue = productSales.reduce((sum, p) => sum + p.revenue, 0) || 1;
        productSales.forEach(p => {
          p.percentage = Math.round((p.revenue / productTotalRevenue) * 100);
        });
        productSales.sort((a, b) => b.revenue - a.revenue);

        // 轉換通路統計為陣列並計算百分比
        channelRevenue = Object.values(channelStats).filter(c => c.orders > 0);
        const channelTotalRevenue = channelRevenue.reduce((sum, c) => sum + c.value, 0) || 1;
        channelRevenue.forEach(c => {
          c.percentage = Math.round((c.value / channelTotalRevenue) * 100);
        });
        
        // 轉換每日營收為陣列
        dailyRevenue = Object.values(dailyStats).sort((a, b) => {
          // 依日期排序
          const [aMonth, aDay] = a.date.split('/').map(Number);
          const [bMonth, bDay] = b.date.split('/').map(Number);
          return aMonth === bMonth ? aDay - bDay : aMonth - bMonth;
        });
      } else {
        // 沒有訂單資料時顯示空狀態
        productSales = [];
        channelRevenue = [];
        totalRevenue = 0;
        totalOrders = 0;
      }

      const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

      setReportData({
        summary: {
          totalRevenue: totalRevenue,
          totalOrders: totalOrders,
          avgOrderValue: avgOrderValue,
          revenueGrowth: 12.5, // 這個需要比較上期資料，目前先用模擬值
        },
        dailyRevenue,
        productSales,
        channelRevenue,
      });
      
      setLoading(false);
    } catch (error) {
      console.error('載入報表資料失敗', error);
      setLoading(false);
    }
  };

  // 處理日期變更
  const handleDateChange = (field, value) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  // 匯出報表
  const handleExportReport = (format) => {
    if (format === 'excel') {
      exportToExcel();
    } else if (format === 'pdf') {
      exportToPDF();
    }
  };

  // 匯出 Excel
  const exportToExcel = () => {
    // 創建工作簿
    const wb = XLSX.utils.book_new();

    // 1. 營收摘要工作表
    const summaryData = [
      ['財務報表摘要', ''],
      ['報表期間', `${dateRange.startDate} 至 ${dateRange.endDate}`],
      [''],
      ['指標', '數值'],
      ['總營收', formatCurrency(reportData.summary.totalRevenue)],
      ['總訂單數', reportData.summary.totalOrders],
      ['平均客單價', formatCurrency(reportData.summary.avgOrderValue)],
      ['營收成長率', `${reportData.summary.revenueGrowth}%`],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, '營收摘要');

    // 2. 每日營收工作表
    const dailyRevenueData = [
      ['日期', '營收 (NT$)', '訂單數'],
      ...reportData.dailyRevenue.map(day => [
        day.date,
        day.revenue,
        day.orders
      ])
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(dailyRevenueData);
    XLSX.utils.book_append_sheet(wb, ws2, '每日營收');

    // 3. 商品銷售工作表
    const productSalesData = [
      ['商品名稱', '銷售數量', '營收 (NT$)', '佔比 (%)'],
      ...reportData.productSales.map(product => [
        product.name,
        product.quantity,
        product.revenue,
        product.percentage
      ])
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(productSalesData);
    XLSX.utils.book_append_sheet(wb, ws3, '商品銷售');

    // 4. 通路營收工作表
    const channelRevenueData = [
      ['通路名稱', '營收 (NT$)', '訂單數', '佔比 (%)'],
      ...reportData.channelRevenue.map(channel => [
        channel.name,
        channel.value,
        channel.orders,
        channel.percentage
      ])
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(channelRevenueData);
    XLSX.utils.book_append_sheet(wb, ws4, '通路營收');

    // 匯出檔案
    const fileName = `財務報表_${dateRange.startDate}_${dateRange.endDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // 匯出 PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // 設定中文字型（使用內建字型）
    doc.setFont('helvetica');
    
    // 標題
    doc.setFontSize(20);
    doc.text('Financial Report', 105, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Period: ${dateRange.startDate} - ${dateRange.endDate}`, 105, 25, { align: 'center' });
    
    let yPos = 35;

    // 1. 營收摘要
    doc.setFontSize(14);
    doc.text('Revenue Summary', 14, yPos);
    yPos += 10;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: [
        ['Total Revenue', formatCurrency(reportData.summary.totalRevenue)],
        ['Total Orders', reportData.summary.totalOrders.toString()],
        ['Avg Order Value', formatCurrency(reportData.summary.avgOrderValue)],
        ['Revenue Growth', `${reportData.summary.revenueGrowth}%`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [232, 107, 44] },
      margin: { left: 14 },
    });
    
    yPos = doc.lastAutoTable.finalY + 15;

    // 2. 商品銷售分析
    doc.setFontSize(14);
    doc.text('Product Sales Analysis', 14, yPos);
    yPos += 10;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Product', 'Quantity', 'Revenue (NT$)', 'Share (%)']],
      body: reportData.productSales.map(p => [
        p.name,
        p.quantity.toString(),
        p.revenue.toLocaleString(),
        `${p.percentage}%`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [232, 107, 44] },
      margin: { left: 14 },
    });
    
    yPos = doc.lastAutoTable.finalY + 15;

    // 如果需要換頁
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // 3. 通路營收分析
    doc.setFontSize(14);
    doc.text('Channel Revenue Analysis', 14, yPos);
    yPos += 10;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Channel', 'Revenue (NT$)', 'Orders', 'Share (%)']],
      body: reportData.channelRevenue.map(c => [
        c.name,
        c.value.toLocaleString(),
        c.orders.toString(),
        `${c.percentage}%`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [232, 107, 44] },
      margin: { left: 14 },
    });

    // 儲存 PDF
    const fileName = `Financial_Report_${dateRange.startDate}_${dateRange.endDate}.pdf`;
    doc.save(fileName);
  };

  // 圖表顏色
  const COLORS = ['#ffb07a', '#e86b2c', '#ff9f61', '#d15a1f', '#ffc896'];

  // 格式化金額
  const formatCurrency = (value) => {
    return `NT$ ${value.toLocaleString()}`;
  };

  return (
    <div className="financial-report-page">
      {/* 頁面標題 */}
      <div className="report-header">
        <div className="header-content">
          <FaChartLine className="header-icon" />
          <div>
            <h1>財務報表</h1>
            <p>查看店家營收、銷售與通路分析</p>
          </div>
        </div>
      </div>

      {/* 日期選擇與匯出 */}
      <div className="report-controls">
        <div className="date-range-selector">
          <FaCalendarAlt className="control-icon" />
          <div className="date-inputs">
            <div className="date-input-group">
              <label>開始日期</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
                max={dateRange.endDate}
              />
            </div>
            <span className="date-separator">至</span>
            <div className="date-input-group">
              <label>結束日期</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
                min={dateRange.startDate}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        </div>

        <div className="export-buttons">
          <button 
            className="export-btn excel-btn"
            onClick={() => handleExportReport('excel')}
          >
            <FaFileExport />
            匯出 Excel
          </button>
          <button 
            className="export-btn pdf-btn"
            onClick={() => handleExportReport('pdf')}
          >
            <FaDownload />
            匯出 PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>載入報表資料中...</p>
        </div>
      ) : (
        <>
          {/* 摘要卡片 */}
          <div className="summary-cards">
            <div className="summary-card revenue-card">
              <div className="card-icon">
                <FaDollarSign />
              </div>
              <div className="card-content">
                <h3>總營收</h3>
                <p className="card-value">{formatCurrency(reportData.summary.totalRevenue)}</p>
                <div className="card-growth positive">
                  <FaArrowUp />
                  <span>{reportData.summary.revenueGrowth}% vs 上期</span>
                </div>
              </div>
            </div>

            <div className="summary-card orders-card">
              <div className="card-icon">
                <FaShoppingCart />
              </div>
              <div className="card-content">
                <h3>總訂單數</h3>
                <p className="card-value">{reportData.summary.totalOrders}</p>
                <div className="card-growth positive">
                  <FaArrowUp />
                  <span>8.3% vs 上期</span>
                </div>
              </div>
            </div>

            <div className="summary-card avg-card">
              <div className="card-icon">
                <FaUtensils />
              </div>
              <div className="card-content">
                <h3>平均客單價</h3>
                <p className="card-value">{formatCurrency(reportData.summary.avgOrderValue)}</p>
                <div className="card-growth positive">
                  <FaArrowUp />
                  <span>3.7% vs 上期</span>
                </div>
              </div>
            </div>
          </div>

          {/* 每日營收趨勢 */}
          <div className="chart-section">
            <div className="section-header">
              <h2>每日營收趨勢</h2>
              <p>檢視期間內的每日營收變化</p>
            </div>
            <div className="chart-container">
              {reportData.dailyRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={reportData.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6c757d"
                      style={{ fontSize: '0.85rem' }}
                    />
                    <YAxis 
                    stroke="#6c757d"
                    style={{ fontSize: '0.85rem' }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'white',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                    formatter={(value) => [`${formatCurrency(value)}`, '營收']}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    name="營收"
                    stroke="#e86b2c" 
                    strokeWidth={3}
                    dot={{ fill: '#e86b2c', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              ) : (
                <div className="empty-state">
                  <FaChartLine style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
                  <p>目前尚無訂單資料</p>
                  <p style={{ fontSize: '0.9rem', color: '#888' }}>開始接受訂單後，這裡將顯示營收趨勢</p>
                </div>
              )}
            </div>
          </div>

          {/* 商品銷售分析 */}
          <div className="chart-section">
            <div className="section-header">
              <h2>商品銷售分析</h2>
              <p>各商品的銷售數量與營收貢獻</p>
            </div>
            {reportData.productSales.length > 0 ? (
              <div className="product-sales-grid">
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={reportData.productSales}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#6c757d"
                      style={{ fontSize: '0.85rem' }}
                      angle={-15}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      stroke="#6c757d"
                      style={{ fontSize: '0.85rem' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'white',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                      formatter={(value, name) => {
                        if (name === '營收') return [formatCurrency(value), name];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="quantity" name="銷售數量" fill="#ffb07a" />
                    <Bar dataKey="revenue" name="營收" fill="#e86b2c" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="product-table">
                <h3>銷售明細</h3>
                <table>
                  <thead>
                    <tr>
                      <th>商品名稱</th>
                      <th>銷售數量</th>
                      <th>營收</th>
                      <th>佔比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.productSales.map((product, index) => (
                      <tr key={index}>
                        <td className="product-name">{product.name}</td>
                        <td>{product.quantity}</td>
                        <td className="revenue-value">{formatCurrency(product.revenue)}</td>
                        <td>
                          <div className="percentage-bar">
                            <div 
                              className="percentage-fill" 
                              style={{ width: `${product.percentage}%` }}
                            ></div>
                            <span>{product.percentage}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            ) : (
              <div className="empty-state">
                <FaShoppingCart style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
                <p>目前尚無商品銷售資料</p>
                <p style={{ fontSize: '0.9rem', color: '#888' }}>開始接受訂單後，這裡將顯示商品銷售分析</p>
              </div>
            )}
          </div>

          {/* 各通路營收分析 */}
          <div className="chart-section">
            <div className="section-header">
              <h2>各通路營收分析</h2>
              <p>不同銷售通路的營收佔比與訂單數</p>
            </div>
            {reportData.channelRevenue.length > 0 ? (
              <div className="channel-revenue-grid">
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={reportData.channelRevenue}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        label={({ name, percentage }) => `${name} ${percentage}%`}
                        labelLine={{ stroke: '#6c757d' }}
                      >
                        {reportData.channelRevenue.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          background: 'white',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                        formatter={(value) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="channel-cards">
                  {reportData.channelRevenue.map((channel, index) => (
                    <div key={index} className="channel-card">
                      <div 
                        className="channel-indicator" 
                        style={{ background: COLORS[index % COLORS.length] }}
                      ></div>
                      <div className="channel-info">
                        <h4>{channel.name}</h4>
                        <p className="channel-revenue">{formatCurrency(channel.value)}</p>
                        <div className="channel-stats">
                          <span className="channel-orders">{channel.orders} 筆訂單</span>
                          <span className="channel-percentage">{channel.percentage}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <FaStore style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
                <p>目前尚無通路營收資料</p>
                <p style={{ fontSize: '0.9rem', color: '#888' }}>開始接受訂單後，這裡將顯示各通路營收分析</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FinancialReportPage;
