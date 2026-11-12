import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { api } from "../utils/api.js";

let cachedConfig = null;
let configPromise = null;

function fetchPaymentConfig() {
  if (cachedConfig) return Promise.resolve(cachedConfig);
  if (configPromise) return configPromise;

  configPromise = api
    .get("/payments/config")
    .then((data) => {
      cachedConfig = data;
      return data;
    })
    .catch((err) => {
      configPromise = null;
      throw err;
    });

  return configPromise;
}

let sdkPromise = null;
function loadPayPalSdk(clientId, currency) {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="paypal.com/sdk/js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.paypal));
      existing.addEventListener("error", (err) => {
        sdkPromise = null;
        reject(err);
      });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency || "USD")}&intent=capture`;
    script.async = true;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("Failed to load PayPal JavaScript SDK"));
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
}

function PayButton({ booking, onSuccess }) {
  const containerRef = useRef(null);
  const [config, setConfig] = useState(cachedConfig);
  const [configLoading, setConfigLoading] = useState(!cachedConfig);
  const [configError, setConfigError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [paid, setPaid] = useState(booking?.paymentStatus === "paid");

  // Fetch config on mount
  useEffect(() => {
    let mounted = true;
    if (!cachedConfig) {
      setConfigLoading(true);
      fetchPaymentConfig()
        .then((cfg) => {
          if (mounted) {
            setConfig(cfg);
            setConfigError(null);
          }
        })
        .catch((err) => {
          if (mounted) {
            setConfigError(err.message || "Unable to load payment configuration");
          }
        })
        .finally(() => {
          if (mounted) setConfigLoading(false);
        });
    } else {
      setConfig(cachedConfig);
      setConfigLoading(false);
    }
    return () => {
      mounted = false;
    };
  }, []);

  // Update paid state if booking prop changes
  useEffect(() => {
    if (booking?.paymentStatus === "paid") {
      setPaid(true);
    }
  }, [booking?.paymentStatus]);

  // Mount PayPal Buttons once config is ready and not paid
  useEffect(() => {
    if (!config?.clientId || paid || !containerRef.current) return;

    let mounted = true;
    let buttonsInstance = null;

    loadPayPalSdk(config.clientId, config.currency)
      .then((paypal) => {
        if (!mounted || !containerRef.current) return;

        // Clear existing children to prevent duplicate renders
        containerRef.current.innerHTML = "";

        buttonsInstance = paypal.Buttons({
          style: {
            layout: "horizontal",
            color: "gold",
            shape: "rect",
            label: "pay",
            height: 38,
            tagline: false,
          },
          createOrder: async (data, actions) => {
            setError(null);
            setProcessing(true);
            try {
              const res = await api.post("/payments/create-order", {
                bookingId: booking._id,
              });
              return res.orderId;
            } catch (err) {
              setProcessing(false);
              const msg = err.message || "Failed to create payment order";
              setError(msg);
              throw err;
            }
          },
          onApprove: async (data, actions) => {
            setProcessing(true);
            setError(null);
            try {
              const updatedBooking = await api.post("/payments/capture", {
                orderId: data.orderID,
              });
              setPaid(true);
              setProcessing(false);
              if (onSuccess) onSuccess(updatedBooking);
            } catch (err) {
              setProcessing(false);
              setError(err.message || "Payment capture failed");
            }
          },
          onCancel: (data) => {
            // User closed the popup - NOT an error
            setProcessing(false);
          },
          onError: (err) => {
            setProcessing(false);
            console.error("PayPal checkout error:", err);
            setError("PayPal checkout error. Please try again.");
          },
        });

        if (buttonsInstance.isEligible && !buttonsInstance.isEligible()) {
          setError("PayPal payment is not eligible for this browser/currency.");
          return;
        }

        buttonsInstance.render(containerRef.current).catch((err) => {
          if (mounted) {
            console.error("PayPal render error:", err);
          }
        });
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || "Failed to load PayPal SDK");
        }
      });

    return () => {
      mounted = false;
      if (buttonsInstance && typeof buttonsInstance.close === "function") {
        try {
          buttonsInstance.close();
        } catch (_) {}
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [config?.clientId, config?.currency, paid, booking?._id, onSuccess]);

  if (paid) {
    return (
      <div
        className="pay-success-badge"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          color: "var(--success, #23724a)",
          fontSize: "0.875rem",
          fontWeight: 500,
        }}
      >
        <CheckCircle2 size={16} aria-hidden="true" />
        <span>Paid</span>
      </div>
    );
  }

  if (configLoading) {
    return <span className="pay-demo-note">Loading payment options...</span>;
  }

  if (configError) {
    return (
      <div className="pay-button-wrap">
        <p className="pay-demo-note" style={{ color: "var(--danger, #a93a31)" }}>
          {configError}
        </p>
      </div>
    );
  }

  return (
    <div className="pay-button-wrap" aria-label="Pay now">
      {processing && (
        <span
          className="pay-processing-text"
          style={{
            fontSize: "0.8125rem",
            color: "var(--primary, #2a8c82)",
            fontWeight: 500,
          }}
        >
          Processing payment...
        </span>
      )}

      <div
        ref={containerRef}
        className="pay-button-slot"
        style={{
          pointerEvents: processing ? "none" : "auto",
          opacity: processing ? 0.6 : 1,
          minHeight: "38px",
          maxWidth: "280px",
        }}
      />

      {config?.inrPerUsd && (
        <p
          className="pay-demo-note"
          style={{
            fontSize: "0.75rem",
            color: "var(--ink-muted, #62807a)",
            margin: "var(--s-1) 0 0 0",
            lineHeight: 1.4,
          }}
        >
          Sandbox demo: charged in USD at a fixed rate of INR {config.inrPerUsd} per USD
        </p>
      )}

      {error && (
        <div
          className="alert alert-error"
          role="alert"
          style={{
            marginTop: "var(--s-2)",
            fontSize: "0.8125rem",
            padding: "var(--s-2) var(--s-3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setError(null)}
            style={{ padding: "2px 6px", fontSize: "0.75rem" }}
          >
            <RotateCcw size={12} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

export default PayButton;
