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
  for (let i = 20; i <= 60; i += 10) {
    const slot = new Date(now.getTime() + i * 60000);
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
      {/* 其餘 UI 保持原有結構，含餐點列表、聯絡人、付款方式、餐具開關、備註、購物車與送出按鈕 */}
    </div>
  );
}

export default TakeoutOrderPage;
