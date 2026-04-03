import React, { useMemo } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { FaCheckCircle, FaArrowLeft } from "react-icons/fa";
import styles from "./ConfirmationPage.module.css";

function SurplusConfirmationPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    pickupNumber,
    orderNumber,
    paymentMethod,
    selectedCard,
    selectedCardName,
    selectedCardLastFour,
    isDineIn,
    tableLabel,
    orderItems,
  } = location.state || {};

  const createdAt = useMemo(() => new Date(), []);
  const dateText = createdAt.toLocaleDateString("zh-TW");
  const timeText = createdAt.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const paymentDisplay = useMemo(() => {
    const isCardPayment = paymentMethod === "\u4fe1\u7528\u5361" || paymentMethod === "credit_card";
    if (!isCardPayment) return paymentMethod || "\u672a\u6307\u5b9a";

    const cardName = selectedCardName || selectedCard?.card_holder_name || "\u4fe1\u7528\u5361";
    const lastFour = selectedCardLastFour || selectedCard?.card_last_four || "";
    return lastFour ? `${cardName} (**** ${lastFour})` : cardName;
  }, [paymentMethod, selectedCard, selectedCardName, selectedCardLastFour]);

  const displayItems = Array.isArray(orderItems) ? orderItems : [];
  const hasItems = displayItems.length > 0;
  const orderTotal = displayItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <div className={styles["confirmation-page"]} style={{ marginTop: "8px" }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className={styles["success-header"]}>
              <div className={styles["success-icon"]}>
                <FaCheckCircle />
              </div>
              <h1 className={styles["success-title"]}>{"\u8a02\u55ae\u5efa\u7acb\u6210\u529f"}</h1>
              <p className={styles["success-subtitle"]}>
                {"\u60dc\u798f\u9910\u9ede\u4e0b\u55ae\u5b8c\u6210\uff0c\u8acb\u4f9d\u53d6\u9910\u865f\u78bc\u9818\u53d6"}
              </p>
            </div>

            <div className={styles.receipt}>
              <div className={styles["shop-name"]}>{"\u60dc\u798f\u8a02\u55ae\u6536\u64da"}</div>
              <div className={styles.info}>
                <div>{"\u5efa\u7acb\u65e5\u671f\uff1a"}{dateText}</div>
                <div>{"\u5efa\u7acb\u6642\u9593\uff1a"}{timeText}</div>
              </div>

              <table className={styles["receipt-table"]}>
                <thead>
                  <tr>
                    <th>{"\u54c1\u9805"}</th>
                    <th>{"\u6578\u91cf"}</th>
                    <th>{"\u5c0f\u8a08"}</th>
                  </tr>
                </thead>
                <tbody>
                  {hasItems ? (
                    displayItems.map((item, idx) => (
                      <tr key={`${item.name || "item"}-${idx}`}>
                        <td>{item.name}</td>
                        <td>{item.quantity || 1}</td>
                        <td>{`NT$ ${Math.round(Number(item.amount || 0))}`}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td>{"\u8a02\u55ae\u5167\u5bb9"}</td>
                      <td>1</td>
                      <td>{"\u8acb\u65bc\u8a02\u55ae\u8a18\u9304\u67e5\u770b"}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className={styles.total}>
                <span>{"\u8a02\u55ae\u91d1\u984d"}</span>
                <span>{`NT$ ${Math.round(orderTotal)}`}</span>
              </div>

              <div className={styles["meta-block"]}>
                <div className={styles["meta-row"]}>
                  <span>{"\u8a02\u55ae\u7de8\u865f"}</span>
                  <strong>{`#${orderNumber || orderId}`}</strong>
                </div>
                <div className={styles["meta-row"]}>
                  <span>{"\u53d6\u9910\u865f\u78bc"}</span>
                  <strong>{pickupNumber || "\u5f85\u7522\u751f"}</strong>
                </div>
                <div className={styles["meta-row"]}>
                  <span>{"\u4ed8\u6b3e\u65b9\u5f0f"}</span>
                  <strong>{paymentDisplay}</strong>
                </div>
                {isDineIn && tableLabel && (
                  <div className={styles["meta-row"]}>
                    <span>{"\u684c\u865f"}</span>
                    <strong>{tableLabel}</strong>
                  </div>
                )}
              </div>

              <div className={styles.barcode}>
                <span className={styles["pickup-badge"]}>
                  {"\u53d6\u9910\u865f\u78bc"} {pickupNumber || "\u5f85\u7522\u751f"}
                </span>
              </div>

              <p className={styles.thanks}>{"\u611f\u8b1d\u60a8\u7684\u8a02\u8cfc\uff0c\u795d\u60a8\u7528\u9910\u6109\u5feb\u3002"}</p>
            </div>

            <div className={styles["surplus-notice"]}>
              {"\u60dc\u798f\u9910\u9ede\u6578\u91cf\u6709\u9650\uff0c\u8acb\u76e1\u5feb\u5230\u5e97\u9818\u53d6\u3002"}
            </div>

            <div className={styles["action-buttons"]}>
              <button className="btn btn-secondary" onClick={() => navigate("/customer-home")}>
                <FaArrowLeft className="me-2" />
                {"\u8fd4\u56de\u9996\u9801"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SurplusConfirmationPage;
