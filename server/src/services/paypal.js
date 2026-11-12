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
