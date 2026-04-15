import React, { useEffect, useMemo, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { v4 as uuid } from 'uuid';
import {
  getMyStore,
  getDineInLayout,
  saveDineInLayout,
} from '../../../api/storeApi';
import {
  getAllTables,
  normalizeDineInLayout,
  serializeDineInLayout,
} from '../../../utils/dineInLayout';
import styles from './DineInSettingsPage.module.css';

const TABLE_SHAPES = [
  { id: 'rectangle', label: '長方形' },
  { id: 'square', label: '正方形' },
  { id: 'circle', label: '圓形' },
];

const MIN_SEATS = 1;
const MAX_SEATS = 12;

const clampSeats = (value) => Math.min(MAX_SEATS, Math.max(MIN_SEATS, value));

const DineInSettingsPage = () => {
  const [storeId, setStoreId] = useState(null);
  const [isLoadingStore, setIsLoadingStore] = useState(true);
  const [floors, setFloors] = useState([]);
  const [activeFloorId, setActiveFloorId] = useState('');
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

  const withQrUrl = (table) => ({
    ...table,
    qrUrl: buildTableUrl(table.label),
  });

  const hydrateFloorsForView = (layout) => {
    return (layout?.floors || []).map((floor) => ({
      ...floor,
      tables: (floor.tables || []).map(withQrUrl),
    }));
  };

  useEffect(() => {
    if (!storeId) return;

    async function loadLayout() {
      try {
        const res = await getDineInLayout(storeId);
        const normalized = normalizeDineInLayout(res.data);
        const hydratedFloors = hydrateFloorsForView(normalized);
        setFloors(hydratedFloors);
        setActiveFloorId(normalized.activeFloorId || hydratedFloors[0]?.id || '');
        setSelectedTableId(null);
      } catch (err) {
        console.error('Failed to load dine-in layout', err);
      }
    }

    loadLayout();
  }, [storeId]);

  const activeFloor = useMemo(
    () => floors.find((floor) => floor.id === activeFloorId) || floors[0] || null,
    [floors, activeFloorId]
  );

  const activeTables = activeFloor?.tables || [];

  const selectedTable = useMemo(
    () => activeTables.find((table) => table.id === selectedTableId),
    [selectedTableId, activeTables]
  );

  const totalTables = useMemo(() => getAllTables(floors).length, [floors]);

  const updateActiveFloor = (updater) => {
    if (!activeFloorId) return;
    setFloors((prev) =>
      prev.map((floor) => {
        if (floor.id !== activeFloorId) {
          return floor;
        }
        return updater(floor);
      })
    );
  };

  const handleDrag = (e, id) => {
    if (!activeFloorId) return;

    const canvasRect = e.currentTarget.parentElement.getBoundingClientRect();
    const offsetX = e.clientX - canvasRect.left;
    const offsetY = e.clientY - canvasRect.top;

    updateActiveFloor((floor) => ({
      ...floor,
      tables: floor.tables.map((table) =>
        table.id === id ? { ...table, x: offsetX - 40, y: offsetY - 40 } : table
      ),
    }));
  };

  const getNextFloorName = () => {
    const existingNames = new Set(floors.map((floor) => floor.name));
    let number = floors.length + 1;
    let candidate = `${number}F`;

    while (existingNames.has(candidate)) {
      number += 1;
      candidate = `${number}F`;
    }

    return candidate;
  };

  const handleAddFloor = () => {
    const newFloor = {
      id: uuid(),
      name: getNextFloorName(),
      tables: [],
    };

    setFloors((prev) => [...prev, newFloor]);
    setActiveFloorId(newFloor.id);
    setSelectedTableId(null);
  };

  const handleDeleteActiveFloor = () => {
    if (!activeFloor || floors.length <= 1) {
      return;
    }

    if (!window.confirm(`確定要刪除 ${activeFloor.name} 嗎？此樓層桌位會一併刪除。`)) {
      return;
    }

    const remainingFloors = floors.filter((floor) => floor.id !== activeFloor.id);
    setFloors(remainingFloors);
    setActiveFloorId(remainingFloors[0]?.id || '');
    setSelectedTableId(null);
  };

  const handleActiveFloorNameBlur = () => {
    if (!activeFloor) return;
    const fallbackName = `${floors.findIndex((floor) => floor.id === activeFloor.id) + 1}F`;
    updateActiveFloor((floor) => ({
      ...floor,
      name: (floor.name || '').trim() || fallbackName,
    }));
  };

  const getNextTableLabel = () => {
    const existing = new Set(getAllTables(floors).map((table) => table.label));
    let number = getAllTables(floors).length + 1;
    let candidate = `桌 ${number}`;

    while (existing.has(candidate)) {
      number += 1;
      candidate = `桌 ${number}`;
    }

    return candidate;
  };

  const handleAddTable = () => {
    if (!storeId || !activeFloorId) return;

    const baseLabel = getNextTableLabel();
    const table = {
      id: uuid(),
      shape: newTableConfig.shape,
      seats: 4,
      label: baseLabel,
      x: 60,
      y: 60,
      qrUrl: buildTableUrl(baseLabel),
    };

    updateActiveFloor((floor) => ({
      ...floor,
      tables: [...floor.tables, table],
    }));

    setSelectedTableId(table.id);
  };

  const updateSelectedTable = (changes) => {
    if (!selectedTableId || !activeFloorId) return;

    updateActiveFloor((floor) => ({
      ...floor,
      tables: floor.tables.map((table) =>
        table.id === selectedTableId ? { ...table, ...changes } : table
      ),
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
      const payload = serializeDineInLayout(floors, activeFloorId);
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
    <div className={styles.dineinSettingsContainer}>
      <div className={styles.dineinTopBar}>
        <button
          className={styles.saveButton}
          type="button"
          onClick={handleSaveLayout}
          disabled={!storeId}
        >
          儲存配置
        </button>
        {saveStatus && <span className={styles.saveStatus}>{saveStatus}</span>}
      </div>
      <div className={styles.dineinSettingsPage}>
        <div className={styles.dineinToolbox}>
          <h2>內用設定</h2>
          <p>可新增樓層分布圖，並在每層調整桌位形狀、位置與座位數。</p>

          <section className={styles.floorConfig}>
            <h4>樓層配置</h4>

            <div className={styles.floorTabs}>
              {floors.map((floor) => (
                <button
                  key={floor.id}
                  type="button"
                  className={activeFloorId === floor.id ? styles.floorTabActive : styles.floorTab}
                  onClick={() => {
                    setActiveFloorId(floor.id);
                    setSelectedTableId(null);
                  }}
                >
                  {floor.name}
                </button>
              ))}
              <button
                type="button"
                className={styles.addFloorBtn}
                onClick={handleAddFloor}
                disabled={!storeId}
              >
                + 新增樓層
              </button>
            </div>

            {activeFloor && (
              <>
                <label className={styles.sectionLabel}>目前樓層名稱</label>
                <input
                  type="text"
                  value={activeFloor.name}
                  onChange={(e) => updateActiveFloor((floor) => ({ ...floor, name: e.target.value }))}
                  onBlur={handleActiveFloorNameBlur}
                  placeholder="例如：1F"
                />

                <button
                  type="button"
                  className={styles.deleteFloorBtn}
                  onClick={handleDeleteActiveFloor}
                  disabled={floors.length <= 1}
                >
                  刪除目前樓層
                </button>
              </>
            )}
          </section>

          <section className={styles.tableConfig}>
            <h4>新增桌位</h4>

            <label className={styles.sectionLabel}>桌面形狀</label>
            <div className={styles.shapeOptions}>
              {TABLE_SHAPES.map((shape) => (
                <button
                  key={shape.id}
                  className={newTableConfig.shape === shape.id ? styles.shapeOptionActive : styles.shapeOption}
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
              className={styles.addTableBtn}
              type="button"
              onClick={handleAddTable}
              disabled={!storeId || !activeFloor}
            >
              加入 {activeFloor?.name || ''} 畫布
            </button>
          </section>

          {selectedTable && (
            <section className={styles.tableEditor}>
              <h4>編輯桌位</h4>

              <label className={styles.sectionLabel}>桌號名稱</label>
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

              <label className={styles.sectionLabel}>桌面形狀</label>
              <div className={styles.shapeOptions}>
                {TABLE_SHAPES.map((shape) => (
                  <button
                    key={shape.id}
                    className={selectedTable.shape === shape.id ? styles.shapeOptionActive : styles.shapeOption}
                    type="button"
                    onClick={() => updateSelectedTable({ shape: shape.id })}
                  >
                    {shape.label}
                  </button>
                ))}
              </div>

              <label className={styles.sectionLabel}>容納人數</label>
              <div className={styles.seatCounter}>
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
                <div className={styles.qrPanel}>
                  <QRCodeCanvas value={selectedTable.qrUrl} size={160} />
                  <p className="qr-table-name">{selectedTable.label}</p>
                  <p className={styles.qrLink}>{selectedTable.qrUrl}</p>
                  <div className={styles.qrActions}>
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
                className={styles.deleteTableBtn}
                type="button"
                onClick={() => {
                  if (window.confirm(`確定要刪除 ${selectedTable.label} 嗎？`)) {
                    updateActiveFloor((floor) => ({
                      ...floor,
                      tables: floor.tables.filter((table) => table.id !== selectedTableId),
                    }));
                    setSelectedTableId(null);
                  }
                }}
              >
                刪除桌位
              </button>
            </section>
          )}
        </div>

        <div className={styles.dineinCanvas} id="canvas">
          <div className={styles.floorCanvasHeader}>
            <strong>{activeFloor?.name || '1F'} 分布圖</strong>
            <span>桌位數：{activeTables.length} / 全店 {totalTables}</span>
          </div>

          {activeTables.map((table) => {
            const shapeClass = table.shape === 'rectangle' ? styles.tableItemRectangle
              : table.shape === 'square' ? styles.tableItemSquare
                : styles.tableItemCircle;
            const selectedClass = selectedTableId === table.id ? ` ${styles.tableItemSelected}` : '';
            return (
              <div
                key={table.id}
                className={`${shapeClass}${selectedClass}`}
                style={{ left: table.x, top: table.y }}
                onMouseDown={() => setSelectedTableId(table.id)}
                onMouseMove={(e) => {
                  if (selectedTableId === table.id && e.buttons === 1) {
                    handleDrag(e, table.id);
                  }
                }}
              >
                <span className={styles.tableLabel}>{table.label}</span>
                <small>{table.seats} 人</small>
              </div>
            );
          })}

          {activeFloor && activeTables.length === 0 && (
            <div className={styles.dineinEmpty}>
              <p>{activeFloor.name} 尚未新增桌位，點左側「加入畫布」即可建立。</p>
            </div>
          )}

          {!isLoadingStore && !storeId && (
            <div className={styles.dineinEmpty}>
              <p>無法取得店家資訊，請重新整理或檢查帳號。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DineInSettingsPage;
