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
    
    // 模擬 API 請求
    setTimeout(() => {
      // 模擬每日營收資料
      const dailyRevenue = generateDailyRevenue();
      
      // 模擬商品銷售資料
      const productSales = [
        { name: '招牌雞腿飯', quantity: 156, revenue: 31200, percentage: 28 },
        { name: '滷肉飯', quantity: 234, revenue: 28080, percentage: 25 },
        { name: '排骨便當', quantity: 98, revenue: 19600, percentage: 18 },
        { name: '素食套餐', quantity: 67, revenue: 13400, percentage: 12 },
        { name: '炒飯', quantity: 89, revenue: 13350, percentage: 12 },
        { name: '其他', quantity: 45, revenue: 5850, percentage: 5 },
      ];

      // 模擬通路營收資料
      const channelRevenue = [
        { name: '內用', value: 45200, percentage: 40, orders: 189 },
        { name: '外帶', value: 39250, percentage: 35, orders: 312 },
        { name: '外送', value: 22600, percentage: 20, orders: 156 },
        { name: '預訂', value: 5650, percentage: 5, orders: 34 },
      ];

      const totalRevenue = dailyRevenue.reduce((sum, day) => sum + day.revenue, 0);
      const totalOrders = channelRevenue.reduce((sum, ch) => sum + ch.orders, 0);

      setReportData({
        summary: {
          totalRevenue: totalRevenue,
          totalOrders: totalOrders,
          avgOrderValue: Math.round(totalRevenue / totalOrders),
          revenueGrowth: 12.5,
        },
        dailyRevenue,
        productSales,
        channelRevenue,
      });
      
      setLoading(false);
    }, 800);
  };

  // 生成每日營收資料
  const generateDailyRevenue = () => {
    const days = [];
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const dayCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    for (let i = 0; i < Math.min(dayCount, 30); i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dayName = date.toLocaleDateString('zh-TW', { month: 'M/d', weekday: 'short' });
      
      days.push({
        date: dayName,
        revenue: Math.round(2000 + Math.random() * 3000),
        orders: Math.round(15 + Math.random() * 30),
      });
    }
    return days;
  };

  // 處理日期變更
  const handleDateChange = (field, value) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  // 匯出報表
  const handleExportReport = (format) => {
    alert(`匯出 ${format.toUpperCase()} 報表功能開發中...`);
    
    // 實際實作時可以使用 xlsx 或 jsPDF 套件
    // 例如：
    // if (format === 'excel') {
    //   exportToExcel(reportData);
    // } else if (format === 'pdf') {
    //   exportToPDF(reportData);
    // }
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
            </div>
          </div>

          {/* 商品銷售分析 */}
          <div className="chart-section">
            <div className="section-header">
              <h2>商品銷售分析</h2>
              <p>各商品的銷售數量與營收貢獻</p>
            </div>
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
          </div>

          {/* 各通路營收分析 */}
          <div className="chart-section">
            <div className="section-header">
              <h2>各通路營收分析</h2>
              <p>不同銷售通路的營收佔比與訂單數</p>
            </div>
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
          </div>
        </>
      )}
    </div>
  );
};

export default FinancialReportPage;
