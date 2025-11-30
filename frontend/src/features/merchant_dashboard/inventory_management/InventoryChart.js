import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';

const InventoryChart = ({ ingredients }) => {
  // 準備圖表數據
  const data = ingredients.map(item => ({
    name: item.name,
    quantity: parseFloat(item.quantity),
    minimum_stock: parseFloat(item.minimum_stock),
    unit: item.unit,
    isLowStock: parseFloat(item.quantity) < parseFloat(item.minimum_stock)
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip" style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
          <p className="label" style={{ fontWeight: 'bold', margin: '0 0 5px 0' }}>{`${label}`}</p>
          <p className="intro" style={{ margin: '0' }}>{`庫存: ${data.quantity} ${data.unit}`}</p>
          <p className="desc" style={{ margin: '0', color: '#666' }}>{`最低庫存: ${data.minimum_stock} ${data.unit}`}</p>
          {data.isLowStock && <p style={{ color: '#ff4d4f', fontWeight: 'bold', margin: '5px 0 0 0' }}>⚠️ 庫存不足！</p>}
        </div>
      );
    }
    return null;
  };

  // 計算庫存不足的項目數量
  const lowStockCount = data.filter(item => item.isLowStock).length;

  return (
    <div className="inventory-chart-container" style={{ 
      width: '100%', 
      height: 450, 
      marginBottom: '2rem', 
      padding: '1.5rem', 
      backgroundColor: 'white', 
      borderRadius: '8px', 
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>庫存概況</h3>
        {lowStockCount > 0 && (
          <div style={{ color: '#ff4d4f', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ⚠️ 有 {lowStockCount} 個項目庫存不足
          </div>
        )}
      </div>
      
      <ResponsiveContainer width="100%" height="85%">
        <BarChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 30,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="name" 
            angle={-45} 
            textAnchor="end" 
            height={60} 
            interval={0}
            tick={{fontSize: 12}}
          />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="top" height={36}/>
          <Bar dataKey="quantity" name="庫存數量" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.isLowStock ? '#ff4d4f' : '#1890ff'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '0.9rem', color: '#666', display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#1890ff', marginRight: '5px', borderRadius: '2px' }}></span>
          正常庫存
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#ff4d4f', marginRight: '5px', borderRadius: '2px' }}></span>
          庫存不足
        </div>
      </div>
    </div>
  );
};

export default InventoryChart;
