let cachedToken = null;
let tokenExpiresAt = 0;

function getCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const apiBase = (process.env.PAYPAL_API || "https://api-m.sandbox.paypal.com").replace(/\/+$/, "");

  if (!clientId || !clientSecret) {
    throw new Error("Missing required PayPal credentials (PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET)");
  }

  return { clientId, clientSecret, apiBase };
}

export async function getAccessToken() {
  // Return cached token if valid with at least 60s buffer
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const { clientId, clientSecret, apiBase } = getCredentials();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    console.error(`PayPal auth error: HTTP ${response.status}`);
    throw new Error("Failed to authenticate with PayPal");
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  return cachedToken;
}

export async function createOrder({ amount, currency, bookingId, description }) {
  const token = await getAccessToken();
  const { apiBase } = getCredentials();

  const response = await fetch(`${apiBase}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: bookingId.toString(),
          custom_id: bookingId.toString(),
          description: description || `RentMate Booking #${bookingId}`,
          amount: {
            currency_code: currency,
            value: amount,
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error(`PayPal createOrder error: HTTP ${response.status}`);
    throw new Error("Failed to create PayPal order");
  }

  const orderData = await response.json();
  return orderData;
}

export async function captureOrder(orderId) {
  const token = await getAccessToken();
  const { apiBase } = getCredentials();

  const response = await fetch(`${apiBase}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    console.error(`PayPal captureOrder error: HTTP ${response.status}`);
    const errData = await response.json().catch(() => null);
    const error = new Error("Failed to capture PayPal order");
    error.status = response.status;
    error.issue = errData?.details?.[0]?.issue;
    throw error;
  }

  const captureData = await response.json();
  return captureData;
}

export async function getOrder(orderId) {
  const token = await getAccessToken();
  const { apiBase } = getCredentials();

  const response = await fetch(`${apiBase}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    console.error(`PayPal getOrder error: HTTP ${response.status}`);
    return null;
  }

  return response.json();
}

export async function refundCapture(captureId, note) {
  const token = await getAccessToken();
  const { apiBase } = getCredentials();

  const response = await fetch(`${apiBase}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(note ? { note_to_payer: note } : {}),
  });

  if (!response.ok) {
    console.error(`PayPal refundCapture error: HTTP ${response.status}`);
    const errData = await response.json().catch(() => null);
    const error = new Error("Failed to refund PayPal payment");
    error.status = response.status;
    error.issue = errData?.details?.[0]?.issue;
    throw error;
  }

  const refundData = await response.json();
  return refundData;
}

export async function createInvoice({ booking, recipientEmail, recipientName, note }) {
  const token = await getAccessToken();
  const { apiBase } = getCredentials();
  const inrPerUsd = Number(process.env.INR_PER_USD) || 85;
  const currency = process.env.PAYPAL_CURRENCY || "USD";

  const rentTotal = ((booking.monthlyRent * booking.months) / inrPerUsd).toFixed(2);
  const depositTotal = (booking.deposit / inrPerUsd).toFixed(2);

  const invoicePayload = {
    detail: {
      invoice_number: `INV-${booking._id.toString().slice(-6)}-${Date.now().toString().slice(-4)}`,
      invoice_date: new Date().toISOString().slice(0, 10),
      currency_code: currency,
      note: note || `RentMate Rental Booking #${booking._id}`,
      term: "DUE_ON_RECEIPT",
    },
    invoicer: {
      name: {
        given_name: "RentMate",
        surname: "Rentals",
      },
    },
    primary_recipients: [
      {
        billing_info: {
          name: {
            given_name: recipientName || "Valued Renter",
          },
          email_address: recipientEmail,
        },
      },
    ],
    items: [
      {
        name: `Rental: ${booking.product?.name || "Item"} (${booking.months} month${booking.months > 1 ? "s" : ""})`,
        quantity: "1",
        unit_amount: {
          currency_code: currency,
          value: rentTotal,
        },
      },
      {
        name: "Security Deposit (Refundable upon return)",
        quantity: "1",
        unit_amount: {
          currency_code: currency,
          value: depositTotal,
        },
      },
    ],
    configuration: {
      allow_tip: false,
      tax_calculated_after_discount: false,
      tax_inclusive: false,
    },
  };

  const response = await fetch(`${apiBase}/v2/invoicing/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(invoicePayload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    console.error(`PayPal createInvoice error: HTTP ${response.status}`, errData);
    throw new Error(errData?.message || "Failed to create PayPal invoice");
  }

  const invoiceData = await response.json();
  const invoiceId = invoiceData.id || invoiceData.href?.split("/").pop();
  return { ...invoiceData, id: invoiceId };
}

export async function sendInvoice(invoiceId) {
  const token = await getAccessToken();
  const { apiBase } = getCredentials();

  const response = await fetch(`${apiBase}/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      send_to_invoicer: true,
      send_to_recipient: true,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    console.error(`PayPal sendInvoice error: HTTP ${response.status}`, errData);
    throw new Error(errData?.message || "Failed to send PayPal invoice");
  }

  return response.json().catch(() => ({ sent: true }));
}

export async function getInvoice(invoiceId) {
  const token = await getAccessToken();
  const { apiBase } = getCredentials();

  const response = await fetch(`${apiBase}/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    console.error(`PayPal getInvoice error: HTTP ${response.status}`);
    return null;
  }

  return response.json();
}

export async function verifyWebhookSignature({ headers, body }) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error("PAYPAL_WEBHOOK_ID environment variable is missing");
    return { verified: false, error: "PAYPAL_WEBHOOK_ID is not configured" };
  }

  // Headers in Express are lowercased
  const transmissionId =
    headers["paypal-transmission-id"] || headers["PAYPAL-TRANSMISSION-ID"];
  const transmissionTime =
    headers["paypal-transmission-time"] || headers["PAYPAL-TRANSMISSION-TIME"];
  const certUrl =
    headers["paypal-cert-url"] || headers["PAYPAL-CERT-URL"];
  const authAlgo =
    headers["paypal-auth-algo"] || headers["PAYPAL-AUTH-ALGO"];
  const transmissionSig =
    headers["paypal-transmission-sig"] || headers["PAYPAL-TRANSMISSION-SIG"];

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    console.error("Missing required PayPal signature headers in webhook request");
    return { verified: false, error: "Missing required PayPal signature headers" };
  }

  const token = await getAccessToken();
  const { apiBase } = getCredentials();

  const verificationPayload = {
    transmission_id: transmissionId,
    transmission_time: transmissionTime,
    cert_url: certUrl,
    auth_algo: authAlgo,
    transmission_sig: transmissionSig,
    webhook_id: webhookId,
    webhook_event: body,
  };

  const response = await fetch(`${apiBase}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(verificationPayload),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error(`PayPal verify-webhook-signature error: HTTP ${response.status} - ${errText}`);
    return { verified: false, error: `Verification API returned HTTP ${response.status}` };
  }

  const result = await response.json();
  const isSuccess = result?.verification_status === "SUCCESS";
  return {
    verified: isSuccess,
    status: result?.verification_status,
  };
}
