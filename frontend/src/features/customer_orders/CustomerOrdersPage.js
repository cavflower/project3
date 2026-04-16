import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../store/AuthContext";
import { db } from "../../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import {
  getUserOrders,
  getOrderNotifications,
  deleteCustomerOrder,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
} from "../../api/orderApi";
import { FaTrash, FaTimes } from "react-icons/fa";
import styles from "./CustomerOrdersPage.module.css";

const STATUS_MAP = {
  pending: "待處理",
  accepted: "已接單",
  confirmed: "已確認",
  preparing: "準備中",
  ready_for_pickup: "可取餐",
  ready: "可取餐",
  completed: "已完成",
  cancelled: "已取消",
  rejected: "已拒絕",
};

const PAYMENT_MAP = {
  cash: "現金",
  credit_card: "信用卡",
  line_pay: "LINE Pay",
};

const getOrderReviewType = (order) => {
  const raw = (
    order?.order_type ||
    order?.service_channel ||
    order?.channel ||
    ""
  ).toString().toLowerCase();

  if (raw === "dinein" || raw === "dine_in") return "dinein";
  if (raw === "takeout" || raw === "take_away") return "takeout";
  if (order?.order_type_display === "內用") return "dinein";
  if (order?.order_type_display === "外帶") return "takeout";
  return null;
};

const getOrderDeleteType = (order) => {
  const raw = (
    order?.order_type ||
    order?.service_channel ||
    order?.channel ||
    ""
  ).toString().toLowerCase();

  if (raw === "surplus") return "surplus";
  if (raw === "dinein" || raw === "dine_in") return "dinein";
  if (raw === "takeout" || raw === "take_away") return "takeout";

  if (order?.order_type_display === "惜福品") return "surplus";
  if (order?.order_type_display === "內用") return "dinein";
  if (order?.order_type_display === "外帶") return "takeout";

  return null;
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const pickFirstNumber = (...values) => {
  for (const v of values) {
    const n = toNumber(v);
    if (n !== null) return n;
  }
  return null;
};

const formatMoney = (value) => `NT$ ${Math.round(Number(value || 0))}`;

const extractSpecText = (item) => {
  const specs = item.specifications || item.selectedSpecs || item.selected_specs || [];
  if (!Array.isArray(specs) || specs.length === 0) return "";
  const labels = specs
    .map((s) => s.optionName || s.option_name || s.name || s.value)
    .filter(Boolean);
  return labels.length ? `（${labels.join("、")}）` : "";
};

const calcSpecAdjustmentPerUnit = (item) => {
  const specs = item.specifications || item.selectedSpecs || item.selected_specs || [];
  if (!Array.isArray(specs) || specs.length === 0) return 0;
  return specs.reduce((sum, s) => {
    const adj = pickFirstNumber(
      s.priceAdjustment,
      s.price_adjustment,
      s.adjustment,
      s.extra_price
    );
    return sum + (adj || 0);
  }, 0);
};

const normalizeOrderItems = (order) => {
  const rawItems = order.items || order.order_items || order.products || [];
  if (!Array.isArray(rawItems)) return [];

  return rawItems.map((item, idx) => {
    const quantity = pickFirstNumber(item.quantity, item.qty, 1) || 1;
    const unitPrice = pickFirstNumber(
      item.final_unit_price,
      item.unit_price,
      item.price,
      item.base_price
    );
    const specAdjPerUnit = calcSpecAdjustmentPerUnit(item);
    const baseLine = (unitPrice || 0) * quantity;
    const lineWithSpec = ((unitPrice || 0) + specAdjPerUnit) * quantity;
    const lineTotal = pickFirstNumber(
      item.subtotal,
      item.total_price,
      item.line_total,
      item.amount
    );

    // 後端若有提供 subtotal/line_total，直接視為最終金額，避免規格費重複加總。
    // 僅在舊資料缺少 lineTotal 時，才用前端可得資訊推算。
    const subtotal = lineTotal !== null ? lineTotal : lineWithSpec;

    const name =
      item.product_name ||
      item.name ||
      item.title ||
      item.product?.name ||
      `商品 ${idx + 1}`;

    return {
      name,
      quantity,
      subtotal,
      specText: extractSpecText(item),
    };
  });
};

const getOrderTotal = (order, items) => {
  const explicitTotal = pickFirstNumber(
    order.total_amount,
    order.final_total,
    order.final_amount,
    order.total_price,
    order.order_total,
    order.payable_amount,
    order.amount_paid,
    order.total
  );
  const itemSum = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const dynamicTotals = Object.entries(order || {})
    .filter(([key, value]) => {
      if (value === null || value === undefined) return false;
      if (typeof value !== "number" && typeof value !== "string") return false;
      const k = key.toLowerCase();
      return (
        k.includes("total") ||
        k.includes("amount") ||
        k.includes("price") ||
        k.includes("pay")
      );
    })
    .map(([, value]) => Number(value))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 100000);

  const candidateTotals = [
    explicitTotal,
    ...dynamicTotals,
    itemSum,
  ].filter((n) => Number.isFinite(n));

  if (candidateTotals.length === 0) return 0;
  return Math.max(...candidateTotals);
};

const getRealtimeTargets = (orders) => {
  if (!Array.isArray(orders)) return [];

  return orders
    .map((order) => {
      const isSurplusOrder = order.order_type_display === "惜福品";
      if (isSurplusOrder) {
        const orderId = String(order.id || "").trim();
        if (!orderId) return null;
        return {
          collectionName: "surplus_orders",
          docId: orderId,
          key: `surplus_orders:${orderId}`,
        };
      }

      const orderDocId = String(
        order.pickup_number || order.order_number || order.id || ""
      ).trim();
      if (!orderDocId) return null;

      return {
        collectionName: "orders",
        docId: orderDocId,
        key: `orders:${orderDocId}`,
      };
    })
    .filter(Boolean);
};

const CustomerOrdersPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const refreshTimerRef = useRef(null);
  const fetchInFlightRef = useRef(false);
  const pollingPausedUntilRef = useRef(0);

  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || "orders");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const isAuthIssue = useCallback((error) => {
    if (error?.response?.status === 401) return true;
    if (error?.code === 'AUTH_COOLDOWN') return true;
    if (error?.isAuthCooldown) return true;
    return false;
  }, []);

  const pausePollingTemporarily = useCallback((ms = 30000) => {
    pollingPausedUntilRef.current = Date.now() + ms;
  }, []);

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (fetchInFlightRef.current) return;
    if (silent && Date.now() < pollingPausedUntilRef.current) return;

    fetchInFlightRef.current = true;

    if (!silent) {
      setLoading(true);
    }

    try {
      const [ordersResponse, notificationsResponse] = await Promise.all([
        getUserOrders(),
        getOrderNotifications(),
      ]);
      setOrders(Array.isArray(ordersResponse.data) ? ordersResponse.data : []);
      setNotifications(Array.isArray(notificationsResponse.data) ? notificationsResponse.data : []);
    } catch (error) {
      if (isAuthIssue(error)) {
        pausePollingTemporarily();
      } else {
        console.error("載入訂單資料失敗:", error);
      }
    } finally {
      fetchInFlightRef.current = false;
      if (!silent) {
        setLoading(false);
      }
    }
  }, [isAuthIssue, pausePollingTemporarily]);

  const scheduleSilentRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(() => {
      fetchData({ silent: true });
    }, 250);
  }, [fetchData]);

  useEffect(() => {
    if (!user) return;
    pollingPausedUntilRef.current = 0;
    fetchData();
  }, [fetchData, user]);

  useEffect(() => {
    const onAuthError = (event) => {
      if (event?.detail?.userType === 'customer') {
        pausePollingTemporarily();
      }
    };

    window.addEventListener('dineverse:auth-error', onAuthError);
    return () => {
      window.removeEventListener('dineverse:auth-error', onAuthError);
    };
  }, [pausePollingTemporarily]);

  useEffect(() => {
    if (!user) return undefined;

    const targets = getRealtimeTargets(orders);
    if (targets.length === 0) return undefined;

    const initializedTargets = new Set();
    const unsubs = targets.map((target) =>
      onSnapshot(
        doc(db, target.collectionName, target.docId),
        () => {
          if (!initializedTargets.has(target.key)) {
            initializedTargets.add(target.key);
            return;
          }
          scheduleSilentRefresh();
        },
        (error) => {
          console.error("訂單即時監聽失敗:", error);
        }
      )
    );

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [orders, scheduleSilentRefresh, user]);

  useEffect(() => {
    if (!user) return undefined;

    const intervalId = setInterval(() => {
      fetchData({ silent: true });
    }, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchData, user]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const pagedOrders = useMemo(
    () => orders.slice((currentPage - 1) * 9, currentPage * 9),
    [orders, currentPage]
  );

  const getStatusText = (order) => order.status_display || STATUS_MAP[order.status] || order.status || "未知";

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      pending: styles["status-pending"],
      accepted: styles["status-accepted"],
      confirmed: styles["status-accepted"],
      preparing: styles["status-accepted"],
      ready_for_pickup: styles["status-ready"],
      ready: styles["status-ready"],
      completed: styles["status-completed"],
      rejected: styles["status-rejected"],
      cancelled: styles["status-rejected"],
    };
    return statusMap[status] || "";
  };

  const formatTime = (value) => {
    if (!value) return "未提供";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "未提供";
    return dt.toLocaleString("zh-TW");
  };

  const getPaymentDisplay = (order) => {
    const methodRaw =
      order.payment_method_display ||
      PAYMENT_MAP[order.payment_method] ||
      order.payment_method ||
      "未提供";

    const cardName =
      order.selected_card_name ||
      order.card_holder_name ||
      order.payment_card_name ||
      order.card_name ||
      "";
    const lastFour = order.selected_card_last_four || order.card_last_four || order.last_four || "";

    const isCard = methodRaw === "信用卡" || order.payment_method === "credit_card";
    if (!isCard) return methodRaw;
    if (cardName && lastFour) return `${cardName} (**** ${lastFour})`;
    if (lastFour) return `信用卡 (**** ${lastFour})`;
    if (cardName) return cardName;
    return "信用卡";
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      fetchData();
    } catch (error) {
      console.error("全部標示已讀失敗:", error);
    }
  };

  const handleDeleteNotification = async (id) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error("刪除通知失敗:", error);
    }
  };

  const handleDeleteAllNotifications = async () => {
    if (!window.confirm("確定要刪除全部通知嗎？")) return;
    try {
      await deleteAllNotifications();
      setNotifications([]);
    } catch (error) {
      console.error("刪除全部通知失敗:", error);
    }
  };

  const handleDeleteOrderRecord = async (order) => {
    const orderType = getOrderDeleteType(order);
    if (!orderType || !order?.id) {
      window.alert("此訂單暫時無法刪除");
      return;
    }

    const confirmed = window.confirm("確定要刪除此筆訂單紀錄嗎？刪除後可在顧客端清單中移除。\n（店家端紀錄不受影響）");
    if (!confirmed) return;

    try {
      await deleteCustomerOrder(orderType, order.id);
      setOrders((prev) => prev.filter((item) => !(item.id === order.id && getOrderDeleteType(item) === orderType)));
      setSelectedOrder(null);
      window.alert("訂單紀錄已刪除");
    } catch (error) {
      const detail = error?.response?.data?.detail;
      window.alert(detail || "刪除失敗，請稍後再試");
    }
  };

  if (loading) {
    return (
      <div className={styles["customer-orders-page"]}>
        <div className="loading-container">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">載入中...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles["customer-orders-page"]}>
      <div className={styles["page-header"]}>
        <h1>我的訂單與通知</h1>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles["tab-button"]} ${activeTab === "orders" ? styles.active : ""}`}
          onClick={() => setActiveTab("orders")}
        >
          訂單列表 ({orders.length})
        </button>
        <button
          className={`${styles["tab-button"]} ${activeTab === "notifications" ? styles.active : ""}`}
          onClick={() => setActiveTab("notifications")}
        >
          通知 ({notifications.filter((n) => !n.is_read).length})
        </button>
      </div>

      {activeTab === "orders" && (
        <div className="orders-section">
          {orders.length > 0 ? (
            <>
              <div className={styles["orders-list"]}>
                {pagedOrders.map((order) => {
                  const orderNo = order.pickup_number || order.order_number || order.id;
                  return (
                    <div
                      key={order.id}
                      className={styles["order-card"]}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedOrder(order)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelectedOrder(order);
                      }}
                    >
                      <div className={styles["order-header"]}>
                        <div className={styles["order-info"]}>
                          <h3>{order.store_name || "未知店家"}</h3>
                          <span className={styles["order-number"]}>訂單號碼: {orderNo}</span>
                          <span className={styles["order-type-badge"]}>
                            {order.order_type_display || (order.channel === "dine_in" ? "內用" : "外帶")}
                          </span>
                        </div>
                        <div className={`${styles["status-badge"]} ${getStatusBadgeClass(order.status)}`}>
                          {getStatusText(order)}
                        </div>
                      </div>

                      <div className="order-details">
                        <div className={styles["detail-row"]}>
                          <span className={styles.label}>顧客姓名:</span>
                          <span className={styles.value}>{order.customer_name || "未提供"}</span>
                        </div>
                        <div className={styles["detail-row"]}>
                          <span className={styles.label}>聯絡電話:</span>
                          <span className={styles.value}>{order.customer_phone || "未提供"}</span>
                        </div>
                        <div className={styles["detail-row"]}>
                          <span className={styles.label}>付款方式:</span>
                          <span className={styles.value}>{getPaymentDisplay(order)}</span>
                        </div>
                        <div className={styles["detail-row"]}>
                          <span className={styles.label}>取餐時間:</span>
                          <span className={styles.value}>{formatTime(order.pickup_at)}</span>
                        </div>
                      </div>

                      <div className={styles["detail-hint"]}>點擊查看完整明細</div>
                    </div>
                  );
                })}
              </div>

              {orders.length > 9 && (
                <div className={styles.pagination}>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={styles["page-btn"]}
                  >
                    上一頁
                  </button>
                  <span className={styles["page-info"]}>
                    第 {currentPage} / {Math.ceil(orders.length / 9)} 頁
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(Math.ceil(orders.length / 9), p + 1))}
                    disabled={currentPage >= Math.ceil(orders.length / 9)}
                    className={styles["page-btn"]}
                  >
                    下一頁
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className={styles["no-data"]}>
              <p>目前沒有訂單資料。</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="notifications-section">
          {notifications.length > 0 && (
            <div className={styles["notifications-header"]}>
              <button onClick={handleMarkAllRead} className={styles["mark-all-read-btn"]}>
                全部標示已讀
              </button>
              <button onClick={handleDeleteAllNotifications} className={styles["delete-all-btn"]}>
                <FaTrash className="me-1" />
                清空通知
              </button>
            </div>
          )}

          {notifications.length > 0 ? (
            <div className="notifications-list">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`${styles["notification-card"]} ${!notification.is_read ? styles.unread : ""}`}
                >
                  <div className={styles["notification-content"]}>
                    <div className={styles["notification-type"]}>
                      {notification.notification_type_display || "系統通知"}
                    </div>
                    <div className={styles["notification-message"]}>{notification.message}</div>
                    <div className={styles["notification-meta"]}>
                      <span className={styles["order-number"]}>訂單: {notification.order_number || "-"}</span>
                      <span className={styles["notification-time"]}>{formatTime(notification.created_at)}</span>
                    </div>
                  </div>
                  <button
                    className={styles["delete-notification-btn"]}
                    onClick={() => handleDeleteNotification(notification.id)}
                    title="刪除通知"
                  >
                    <FaTimes />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles["no-data"]}>
              <p>目前沒有通知。</p>
            </div>
          )}
        </div>
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onDeleteOrder={handleDeleteOrderRecord}
          getPaymentDisplay={getPaymentDisplay}
          formatTime={formatTime}
          getStatusText={getStatusText}
        />
      )}
    </div>
  );
};

const OrderDetailModal = ({ order, onClose, onDeleteOrder, getPaymentDisplay, formatTime, getStatusText }) => {
  const items = normalizeOrderItems(order);
  const total = getOrderTotal(order, items);
  const orderNo = order.pickup_number || order.order_number || order.id;
  const reviewType = getOrderReviewType(order);
  const canGoReview = order.status === "completed" && !!reviewType;
  const canDeleteRecord = ["completed", "rejected", "cancelled"].includes((order.status || "").toLowerCase());

  return (
    <div className={styles["order-modal-overlay"]} onClick={onClose}>
      <div className={styles["order-modal"]} onClick={(e) => e.stopPropagation()}>
        <button className={styles["order-modal-close"]} onClick={onClose} aria-label="關閉">
          ×
        </button>

        <div className={styles["order-modal-title"]}>訂單詳細資訊</div>
        <div className={styles["order-modal-store"]}>{order.store_name || "未知店家"}</div>

        <table className={styles["order-modal-table"]}>
          <thead>
            <tr>
              <th>品項</th>
              <th>數量</th>
              <th>小計</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item, idx) => (
                <tr key={`${item.name}-${idx}`}>
                  <td>
                    {item.name}
                    {item.specText && (
                      <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{item.specText}</div>
                    )}
                  </td>
                  <td>{item.quantity}</td>
                  <td>{formatMoney(item.subtotal)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td>無法取得品項明細</td>
                <td>1</td>
                <td>-</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className={styles["order-modal-total"]}>
          <span>總計</span>
          <strong>{formatMoney(total)}</strong>
        </div>

        <div className={styles["order-modal-meta"]}>
          <div>
            <span>訂單號碼</span>
            <strong>{orderNo}</strong>
          </div>
          <div>
            <span>狀態</span>
            <strong>{getStatusText(order)}</strong>
          </div>
          <div>
            <span>付款方式</span>
            <strong>{getPaymentDisplay(order)}</strong>
          </div>
          <div>
            <span>取餐時間</span>
            <strong>{formatTime(order.pickup_at || order.pickup_time)}</strong>
          </div>
          <div>
            <span>建立時間</span>
            <strong>{formatTime(order.created_at)}</strong>
          </div>
          {order.table_label && (
            <div>
              <span>桌號</span>
              <strong>{order.table_label}</strong>
            </div>
          )}
        </div>

        {(canGoReview || canDeleteRecord) && (
          <div className={styles["order-modal-actions"]}>
            {canGoReview && (
              <Link
                to={`/review/${order.id}?type=${reviewType}`}
                className={styles["order-review-btn"]}
                onClick={onClose}
              >
                前往評論
              </Link>
            )}
            {canDeleteRecord && (
              <button
                type="button"
                className={styles["order-delete-btn"]}
                onClick={() => onDeleteOrder(order)}
              >
                刪除紀錄
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerOrdersPage;
