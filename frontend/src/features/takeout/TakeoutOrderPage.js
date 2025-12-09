import React, { useEffect, useMemo, useReducer, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getStore } from "../../api/storeApi";
import { createTakeoutOrder, getTakeoutProducts } from "../../api/orderApi";
import { useAuth } from "../../store/AuthContext";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import "./TakeoutOrderPage.css";

const initialCart = {
  items: [],
  notes: "",
  pickupAt: "",
  contact: { name: "", phone: "" },
};

const paymentOptionsList = [
  { value: "cash", label: "現金" },
  { value: "credit_card", label: "信用卡" },
  { value: "line_pay", label: "LINE Pay" },
];

const formatPrice = (value) => Math.round(Number(value) || 0);
const getImageUrl = (imagePath) => {
  if (!imagePath) return "";
  if (imagePath.startsWith("http")) return imagePath;
  return `http://127.0.0.1:8000${imagePath}`;
};
const pickupTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

function cartReducer(state, action) {
  switch (action.type) {
    case "ADD_ITEM": {
      const existing = state.items.find((item) => item.id === action.payload.id);
      const items = existing
        ? state.items.map((item) =>
            item.id === action.payload.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        : [...state.items, { ...action.payload, quantity: 1 }];
      return { ...state, items };
    }
    case "DECREMENT_ITEM": {
      const items = state.items
        .map((item) =>
          item.id === action.payload
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0);
      return { ...state, items };
    }
    case "CLEAR_CART":
      return { ...state, items: [] };
    case "UPDATE_NOTE":
      return { ...state, notes: action.payload };
    case "UPDATE_PICKUP":
      return { ...state, pickupAt: action.payload };
    case "UPDATE_CONTACT":
      return { ...state, contact: { ...state.contact, ...action.payload } };
    default:
      return state;
  }
}

const pickupSlots = () => {
  const slots = [];
  const now = new Date();
  // 最早可取餐時間：現在 +10 分鐘，並向上取整到最近的 5 分鐘刻度
  const earliest = new Date(now.getTime() + 10 * 60 * 1000);
  const minutes = earliest.getMinutes();
  const roundedMinutes =
    minutes % 5 === 0 ? minutes : minutes + (5 - (minutes % 5));
  earliest.setMinutes(roundedMinutes, 0, 0);

  // 提供 12 個 5 分鐘間隔的時段（約 1 小時範圍）
  for (let i = 0; i < 12; i++) {
    const slot = new Date(earliest.getTime() + i * 5 * 60 * 1000);
    slots.push(slot.toISOString());
  }
  return slots;
};

function TakeoutOrderPage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [store, setStore] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(paymentOptionsList[0].value);
  const [pickupNumber, setPickupNumber] = useState("");
  // 預設不需要餐具，避免未選阻擋送單
  const [useUtensils, setUseUtensils] = useState("no");

  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cart, dispatch] = useReducer(cartReducer, {
    ...initialCart,
    contact: {
      name: user?.name || "",
      phone: user?.phone || "",
    },
    pickupAt: pickupSlots()[0] || "",
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await getStore(storeId);
        setStore(response.data);

        const productsRes = await getTakeoutProducts(storeId);
        setMenuItems(productsRes.data);
      } catch (err) {
        setError("載入資料失敗，請稍後再試");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [storeId]);

  useEffect(() => {
    dispatch({
      type: "UPDATE_CONTACT",
      payload: { name: user?.name || "", phone: user?.phone || "" },
    });
  }, [user]);

  const total = useMemo(
    () => cart.items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    [cart.items]
  );
  const slots = useMemo(pickupSlots, []);

  const handleSubmit = async () => {
    if (!cart.items.length) {
      alert("請先選擇餐點。");
      return;
    }
    if (!cart.contact.name || !cart.contact.phone) {
      alert("請填寫聯絡人姓名與電話。");
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        store: storeId,
        pickup_at: cart.pickupAt,
        customer_name: cart.contact.name,
        customer_phone: cart.contact.phone,
        notes: cart.notes,
        payment_method: paymentMethod,
        use_utensils: useUtensils === "yes",
        items: cart.items.map((item) => ({
          product: item.id,
          quantity: item.quantity,
        })),
      };

      const response = await createTakeoutOrder(payload);
      const orderId = String(response.data?.id || "pending");
      const pickupNo = response.data?.pickup_number;
      setPickupNumber(pickupNo || "");
      dispatch({ type: "CLEAR_CART" });
      const paymentLabel = paymentOptionsList.find((o) => o.value === paymentMethod)?.label;
      try {
        await setDoc(
          doc(db, "orders", orderId),
          {
            orderId,
            pickupNumber: pickupNo || null,
            storeId,
            paymentMethod,
            channel: "takeout",
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (firestoreErr) {
        console.error("Failed to store order in Firestore", firestoreErr);
      }
      alert(`付款方式：${paymentLabel}\n取餐號碼：${pickupNo || "待通知"}`);

      navigate(`/confirmation/${orderId}`, {
        state: {
          pickupNumber: pickupNo || null,
          paymentMethod: paymentLabel || paymentMethod,
        },
      });
    } catch (err) {
      alert("送出失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="takeout-page container py-5 text-center">
        <div className="spinner-border text-primary" role="status" />
        <p className="mt-3">載入中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="takeout-page container py-5">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  return (
    <div className="takeout-page container" style={{ marginTop: "70px" }}>
      <div className="row mb-4">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-body">
              <h2 className="mb-1">{store?.name}</h2>
              <p className="text-muted mb-2">{store?.address}</p>
              <div className="d-flex flex-wrap gap-3">
                <span>
                  <i className="bi bi-telephone me-1" />
                  {store?.phone}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card shadow-sm mb-4 takeout-card">
            <div className="card-header takeout-card-header">
              <strong>餐點列表</strong>
            </div>
            <div className="card-body">
              {menuItems.length === 0 && (
                <p className="text-muted mb-0">目前沒有餐點，請聯絡店家。</p>
              )}
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="d-flex justify-content-between align-items-center border-bottom py-3"
                >
                  <div className="d-flex align-items-center gap-3 me-3">
                    {item.image && (
                      <img
                        src={getImageUrl(item.image)}
                        alt={item.name}
                        style={{
                          width: 80,
                          height: 80,
                          objectFit: "cover",
                          borderRadius: 8,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div>
                      <h5 className="mb-1">{item.name}</h5>
                      <p className="text-muted mb-1">{item.description}</p>
                      <strong>NT$ {formatPrice(item.price)}</strong>
                    </div>
                  </div>
                  <button
                    className="btn btn-outline-primary"
                    onClick={() => dispatch({ type: "ADD_ITEM", payload: item })}
                  >
                    加入
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card shadow-sm takeout-card">
            <div className="card-header takeout-card-header" style={{ color: "black" }}>
              <strong>訂單資訊</strong>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">聯絡人姓名</label>
                <input
                  className="form-control"
                  value={cart.contact.name}
                  onChange={(e) =>
                    dispatch({ type: "UPDATE_CONTACT", payload: { name: e.target.value } })
                  }
                  placeholder="請輸入姓名"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">聯絡電話</label>
                <input
                  className="form-control"
                  value={cart.contact.phone}
                  onChange={(e) =>
                    dispatch({ type: "UPDATE_CONTACT", payload: { phone: e.target.value } })
                  }
                  placeholder="請輸入電話"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">取餐時間</label>
                <select
                  className="form-select"
                  value={cart.pickupAt}
                  onChange={(e) => dispatch({ type: "UPDATE_PICKUP", payload: e.target.value })}
                >
                  {slots.map((slot) => (
                    <option key={slot} value={slot}>
                      {new Date(slot).toLocaleString(undefined, pickupTimeFormatOptions)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label">付款方式</label>
                <select
                  className="form-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {paymentOptionsList.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label">是否需要餐具</label>
                <div className="switch-container">
                  <span>{useUtensils === "yes" ? "需要" : "不需要"}</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={useUtensils === "yes"}
                      onChange={(e) => setUseUtensils(e.target.checked ? "yes" : "no")}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">備註</label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={cart.notes}
                  onChange={(e) =>
                    dispatch({ type: "UPDATE_NOTE", payload: e.target.value })
                  }
                  placeholder="口味或其他需求"
                />
              </div>

              <hr />

              <h5 className="mb-3">購物車</h5>
              {cart.items.length === 0 && (
                <p className="text-muted mb-2">尚未選擇餐點。</p>
              )}
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  className="d-flex justify-content-between align-items-center mb-2"
                >
                  <div>
                    <strong>{item.name}</strong>
                    <p className="mb-0 small text-muted">
                      NT$ {formatPrice(item.price)} × {item.quantity}
                    </p>
                  </div>
                  <div className="btn-group">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => dispatch({ type: "DECREMENT_ITEM", payload: item.id })}
                    >
                      -
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => dispatch({ type: "ADD_ITEM", payload: item })}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              <div className="d-flex justify-content-between align-items-center mt-3">
                <span>小計</span>
                <strong>NT$ {formatPrice(total)}</strong>
              </div>

              <button
                className="btn btn-success w-100 mt-4"
                onClick={handleSubmit}
                disabled={submitting || cart.items.length === 0}
              >
                {submitting ? "送出中..." : "送出訂單"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TakeoutOrderPage;
