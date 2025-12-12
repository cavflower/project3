import React, { useEffect, useMemo, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { v4 as uuid } from 'uuid';
import {
  getMyStore,
  getDineInLayout,
  saveDineInLayout,
} from '../../../api/storeApi';
import './DineInSettingsPage.css';

const TABLE_SHAPES = [
  { id: 'rectangle', label: '長方形' },
  { id: 'square', label: '正方形' },
  { id: 'circle', label: '圓形' },
];

const MIN_SEATS = 1;
const MAX_SEATS = 12;

const clampSeats = (value) => Math.min(MAX_SEATS, Math.max(MIN_SEATS, value));

const hydrateTable = (table, buildUrl) => ({
  id: table.id || uuid(),
  shape: table.shape || 'rectangle',
  seats: table.seats || 4,
  label: table.label || '',
  x: typeof table.x === 'number' ? table.x : 60,
  y: typeof table.y === 'number' ? table.y : 60,
  qrUrl: buildUrl(table.label),
});

const DineInSettingsPage = () => {
  const [storeId, setStoreId] = useState(null);
  const [isLoadingStore, setIsLoadingStore] = useState(true);
  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [newTableConfig, setNewTableConfig] = useState({
    shape: 'rectangle',
  });
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    async function loadStore() {
      try {
        const res = await getMyStore();
        setStoreId(res.data?.id || null);
      } catch (err) {
        if (err.response?.status === 404) {
          console.log('[DineIn] Store not found - merchant needs to create store settings first');
          setStoreId(null);
        } else {
          console.error('[DineIn] Failed to load store info:', err);
        }
      } finally {
        setIsLoadingStore(false);
      }
    }
    loadStore();
  }, []);

  const buildTableUrl = (label) =>
    storeId
      ? `${window.location.origin}/store/${storeId}/dine-in/menu?table=${encodeURIComponent(
          label || ''
        )}`
      : '';

  useEffect(() => {
    if (!storeId) return;
    async function loadLayout() {
      try {
        const res = await getDineInLayout(storeId);
        if (Array.isArray(res.data)) {
          setTables(res.data.map((table) => hydrateTable(table, buildTableUrl)));
        }
      } catch (err) {
        console.error('Failed to load dine-in layout', err);
      }
    }
    loadLayout();
  }, [storeId]);

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId),
    [selectedTableId, tables]
  );

  const handleDrag = (e, id) => {
    const canvasRect = e.currentTarget.parentElement.getBoundingClientRect();
    const offsetX = e.clientX - canvasRect.left;
    const offsetY = e.clientY - canvasRect.top;
    setTables((prev) =>
      prev.map((table) =>
        table.id === id ? { ...table, x: offsetX - 40, y: offsetY - 40 } : table
      )
    );
  };

  const handleAddTable = () => {
    if (!storeId) return;
    const baseLabel = `桌 ${tables.length + 1}`;
    const table = {
      id: uuid(),
      shape: newTableConfig.shape,
      seats: 4,
      label: baseLabel,
      x: 60,
      y: 60,
      qrUrl: buildTableUrl(baseLabel),
    };
    setTables((prev) => [...prev, table]);
    setSelectedTableId(table.id);
  };

  const updateSelectedTable = (changes) => {
    if (!selectedTableId) return;
    setTables((prev) =>
      prev.map((table) =>
        table.id === selectedTableId ? { ...table, ...changes } : table
      )
    );
  };

  const adjustNewSeatCount = (delta) => {
    setNewTableConfig((prev) => ({
      ...prev,
      seats: clampSeats(prev.seats + delta),
    }));
  };

  const adjustSelectedSeatCount = (delta) => {
    if (!selectedTableId) return;
    updateSelectedTable({
      seats: clampSeats((selectedTable?.seats || MIN_SEATS) + delta),
    });
  };

  const handleSaveLayout = async () => {
    if (!storeId) return;
    try {
      const payload = tables.map(({ id, shape, seats, label, x, y }) => ({
        id,
        shape,
        seats,
        label,
        x,
        y,
      }));
      await saveDineInLayout(storeId, payload);
      setSaveStatus('配置已儲存');
    } catch (err) {
      console.error('Failed to save layout', err);
      setSaveStatus('儲存失敗');
    } finally {
      setTimeout(() => setSaveStatus(''), 2000);
    }
  };

  return (
    <div className="dinein-settings-container">
      <div className="dinein-top-bar">
        <button
          className="save-button"
          type="button"
          onClick={handleSaveLayout}
          disabled={!storeId || tables.length === 0}
        >
          儲存配置
        </button>
        {saveStatus && <span className="save-status">{saveStatus}</span>}
      </div>
      <div className="dinein-settings-page">
        <div className="dinein-toolbox">
          <h2>內用設定</h2>
        <p>調整桌面形狀、位置與座位數，並產生可以列印的 QR 取餐碼。</p>

        <section className="table-config">
          <h4>新增桌位</h4>

          <label className="section-label">桌面形狀</label>
          <div className="shape-options">
            {TABLE_SHAPES.map((shape) => (
              <button
                key={shape.id}
                className={`shape-option ${
                  newTableConfig.shape === shape.id ? 'active' : ''
                }`}
                onClick={() =>
                  setNewTableConfig((prev) => ({ ...prev, shape: shape.id }))
                }
                type="button"
              >
                {shape.label}
              </button>
            ))}
          </div>

          <button
            className="add-table-btn"
            type="button"
            onClick={handleAddTable}
            disabled={!storeId}
          >
            加入畫布
          </button>
        </section>

        {selectedTable && (
          <section className="table-editor">
            <h4>編輯桌位</h4>

            <label className="section-label">桌號名稱</label>
            <input
              type="text"
              value={selectedTable.label}
              onChange={(e) =>
                updateSelectedTable({
                  label: e.target.value,
                  qrUrl: buildTableUrl(e.target.value),
                })
              }
            />

            <label className="section-label">桌面形狀</label>
            <div className="shape-options">
              {TABLE_SHAPES.map((shape) => (
                <button
                  key={shape.id}
                  className={`shape-option ${
                    selectedTable.shape === shape.id ? 'active' : ''
                  }`}
                  type="button"
                  onClick={() => updateSelectedTable({ shape: shape.id })}
                >
                  {shape.label}
                </button>
              ))}
            </div>

            <label className="section-label">容納人數</label>
            <div className="seat-counter">
              <button
                type="button"
                onClick={() => adjustSelectedSeatCount(-1)}
                disabled={selectedTable.seats <= MIN_SEATS}
              >
                −
              </button>
              <span>{selectedTable.seats} 人</span>
              <button
                type="button"
                onClick={() => adjustSelectedSeatCount(1)}
                disabled={selectedTable.seats >= MAX_SEATS}
              >
                ＋
              </button>
            </div>

            {selectedTable.qrUrl && (
              <div className="qr-panel">
                <QRCodeCanvas value={selectedTable.qrUrl} size={160} />
                <p className="qr-table-name">{selectedTable.label}</p>
                <p className="qr-link">{selectedTable.qrUrl}</p>
                <div className="qr-actions">
                  <button
                    type="button"
                    onClick={() => window.open(selectedTable.qrUrl, '_blank')}
                  >
                    開啟菜單
                  </button>
                  <button type="button" onClick={() => window.print()}>
                    列印 QR
                  </button>
                </div>
              </div>
            )}
            
            <button
              className="delete-table-btn"
              type="button"
              onClick={() => {
                if (window.confirm(`確定要刪除 ${selectedTable.label} 嗎？`)) {
                  setTables((prev) => prev.filter((t) => t.id !== selectedTableId));
                  setSelectedTableId(null);
                }
              }}
            >
              刪除桌位
            </button>
          </section>
        )}
      </div>

        <div className="dinein-canvas" id="canvas">
          {tables.map((table) => (
            <div
              key={table.id}
            className={`table-item ${table.shape} ${
              selectedTableId === table.id ? 'selected' : ''
            }`}
            style={{ left: table.x, top: table.y }}
            onMouseDown={() => setSelectedTableId(table.id)}
            onMouseMove={(e) => {
              if (selectedTableId === table.id && e.buttons === 1) {
                handleDrag(e, table.id);
              }
            }}
          >
            <span className="table-label">{table.label}</span>
            <small>{table.seats} 人</small>
          </div>
        ))}

          {!isLoadingStore && !storeId && (
            <div className="dinein-empty">
              <p>無法取得店家資訊，請重新整理或檢查帳號。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DineInSettingsPage;
