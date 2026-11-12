import mongoose from "mongoose";
import { Product } from "../models/Product.js";
import { Booking } from "../models/Booking.js";
import { buildProductFilter } from "./productSearch.js";
import { prepareBooking } from "./bookingService.js";
import {
  createOrder as paypalCreateOrder,
  getOrder as paypalGetOrder,
  createInvoice as paypalCreateInvoice,
  sendInvoice as paypalSendInvoice,
  getInvoice as paypalGetInvoice,
} from "./paypal.js";

const SYSTEM_PROMPT =
  "You are RentMate's official PayPal AI rental assistant. You help people find items to rent by the month, check pricing and availability, prepare bookings, and manage PayPal checkout orders and invoices. " +
  "Use search_products to find real items, and only recommend items it returns. " +
  "When the user has chosen an item, a start date and a number of months, call propose_booking. " +
  "When propose_booking returns a proposal, do NOT repeat the line-item numbers, deposit, or total calculation in your text, and never write fake brackets or buttons like '[Confirm Booking]' because the application renders a dedicated interactive card with the full breakdown and a Confirm button directly below your message. Simply invite the user to review the proposal card and confirm. " +
  "When the user asks to pay with PayPal, generate an invoice, or check payment status, use the corresponding PayPal tools. " +
  "You never confirm or create bookings yourself: the user confirms with a button. " +
  "Never work out prices yourself. Quote only the numbers that tools return. " +
  "Prices are in rupees. Answer in concise, natural, friendly text without raw markdown symbols or fake buttons.";

const tools = [
  {
    type: "function",
    function: {
      name: "search_products",
      description:
        "Search the RentMate catalog of items rented by the month. Use it whenever the user needs furniture, electronics or home essentials. Only set category if the user names one.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Words to search for, such as 'desk' or 'chair'" },
          category: { type: "string", description: "Exact category name, only if the user mentioned it" },
          maxPrice: { type: "number", description: "Highest monthly rent in rupees" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_booking",
      description:
        "Check a booking and get the real price. Call it when the user chose an item, a start date (YYYY-MM-DD) and a number of months. It does not create the booking.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "The id returned by search_products" },
          startDate: { type: "string", description: "Start date as YYYY-MM-DD" },
          months: { type: "number", description: "Whole number of months, 1 to 24" },
        },
        required: ["productId", "startDate", "months"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "paypal_create_invoice",
      description:
        "Create and send an official PayPal invoice for a user's booking with an immediate payable link. Call when the user requests an invoice or bill.",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string", description: "The ID of the booking to invoice" },
          note: { type: "string", description: "Optional note or custom instructions for the invoice" },
        },
        required: ["bookingId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "paypal_get_invoice",
      description:
        "Get current status and details of a PayPal invoice.",
      parameters: {
        type: "object",
        properties: {
          invoiceId: { type: "string", description: "The PayPal invoice ID" },
        },
        required: ["invoiceId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "paypal_create_order",
      description:
        "Create a PayPal payment order for a booking.",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string", description: "The booking ID to pay for" },
        },
        required: ["bookingId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "paypal_get_order_status",
      description:
        "Check status and details of a PayPal checkout order.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "The PayPal order ID" },
        },
        required: ["orderId"],
      },
    },
  },
];

async function askModel(messages) {
  const response = await fetch(`${process.env.AI_BASE_URL}chat/completions`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.AI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: process.env.AI_MODEL, messages, tools }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "AI request failed");
  return data.choices[0].message;
}

async function runSearchProducts(rawArguments) {
  let args = {};
  try {
    args = JSON.parse(rawArguments);
  } catch {
    return { error: "Could not read the tool arguments" };
  }

  const clean = { available: true };
  if (typeof args.q === "string") clean.q = args.q;
  if (typeof args.category === "string") clean.category = args.category;
  if (typeof args.maxPrice === "number") clean.maxPrice = args.maxPrice;

  const products = await Product.find(buildProductFilter(clean)).limit(5);

  return products.map((p) => ({
    id: String(p._id),
    name: p.name,
    category: p.category,
    monthlyRent: p.price,
    deposit: p.deposit,
    location: p.location,
  }));
}

async function runProposeBooking(rawArguments, proposals) {
  let args = {};
  try {
    args = JSON.parse(rawArguments);
  } catch {
    return { ok: false, reason: "Could not read the tool arguments" };
  }

  const result = await prepareBooking({
    productId: args.productId,
    startDate: args.startDate,
    months: args.months,
  });
  if (result.error) return { ok: false, reason: result.error.message };

  const proposal = {
    productId: String(result.product._id),
    productName: result.product.name,
    startDate: result.booking.startDate.toISOString().slice(0, 10),
    endDate: result.booking.endDate.toISOString().slice(0, 10),
    months: result.booking.months,
    monthlyRent: result.booking.monthlyRent,
    deposit: result.booking.deposit,
    total: result.booking.total,
  };
  proposals.push(proposal); // the real numbers go to the frontend, not through the model
  return { ok: true, proposal };
}

async function runPayPalCreateInvoice(rawArguments, context) {
  let args = {};
  try {
    args = JSON.parse(rawArguments);
  } catch {
    return { ok: false, reason: "Could not read tool arguments" };
  }

  const { bookingId, note } = args;
  if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
    return { ok: false, reason: "Invalid booking ID" };
  }

  const query = { _id: bookingId };
  if (context?.user?._id) {
    query.user = context.user._id;
  }

  const booking = await Booking.findOne(query).populate("product");
  if (!booking) {
    return { ok: false, reason: "Booking not found" };
  }

  if (booking.paypalInvoiceUrl && booking.paypalInvoiceId) {
    return {
      ok: true,
      invoiceId: booking.paypalInvoiceId,
      invoiceUrl: booking.paypalInvoiceUrl,
      status: "SENT",
      note: "Invoice already exists for this booking",
    };
  }

  try {
    const created = await paypalCreateInvoice({
      booking,
      recipientEmail: context?.user?.email,
      recipientName: context?.user?.name,
      note,
    });

    const invoiceId = created.id;
    let invoiceUrl = created?.detail?.metadata?.payer_view_url;
    try {
      await paypalSendInvoice(invoiceId);
      const detailed = await paypalGetInvoice(invoiceId);
      if (detailed?.detail?.metadata?.payer_view_url) {
        invoiceUrl = detailed.detail.metadata.payer_view_url;
      }
    } catch (_) {}

    if (!invoiceUrl) {
      const isSandbox = (process.env.PAYPAL_API || "").includes("sandbox");
      const host = isSandbox ? "https://www.sandbox.paypal.com" : "https://www.paypal.com";
      invoiceUrl = `${host}/invoice/p/#${invoiceId}`;
    }

    booking.paypalInvoiceId = invoiceId;
    booking.paypalInvoiceUrl = invoiceUrl;
    await booking.save();

    return {
      ok: true,
      invoiceId,
      invoiceUrl,
      status: "SENT",
    };
  } catch (err) {
    const isPermissionError =
      err.message?.toLowerCase().includes("permission") ||
      err.message?.toLowerCase().includes("authorization failed");
    const reason = isPermissionError
      ? "PayPal Invoicing permission is disabled on your PayPal Developer App. Please enable the 'Invoicing' checkbox under App Feature Options in your PayPal Developer Dashboard."
      : err.message || "Failed to create invoice";
    return { ok: false, reason };
  }
}

async function runPayPalGetInvoice(rawArguments) {
  let args = {};
  try {
    args = JSON.parse(rawArguments);
  } catch {
    return { ok: false, reason: "Could not read tool arguments" };
  }

  const invoice = await paypalGetInvoice(args.invoiceId);
  if (!invoice) return { ok: false, reason: "Invoice not found on PayPal" };

  return {
    ok: true,
    invoiceId: invoice.id,
    status: invoice.status,
    amount: invoice.amount?.value,
    currency: invoice.amount?.currency_code,
    invoiceUrl: invoice.detail?.metadata?.payer_view_url,
  };
}

async function runPayPalCreateOrder(rawArguments, context) {
  let args = {};
  try {
    args = JSON.parse(rawArguments);
  } catch {
    return { ok: false, reason: "Could not read tool arguments" };
  }

  const { bookingId } = args;
  if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
    return { ok: false, reason: "Invalid booking ID" };
  }

  const query = { _id: bookingId };
  if (context?.user?._id) {
    query.user = context.user._id;
  }

  const booking = await Booking.findOne(query);
  if (!booking) {
    return { ok: false, reason: "Booking not found" };
  }

  const inrPerUsd = Number(process.env.INR_PER_USD) || 85;
  const currency = process.env.PAYPAL_CURRENCY || "USD";
  const amount = (booking.total / inrPerUsd).toFixed(2);

  try {
    const order = await paypalCreateOrder({
      amount,
      currency,
      bookingId: booking._id.toString(),
      description: `RentMate Booking #${booking._id}`,
    });

    booking.paypalOrderId = order.id;
    await booking.save();

    return {
      ok: true,
      orderId: order.id,
      status: order.status,
    };
  } catch (err) {
    return { ok: false, reason: err.message || "Failed to create PayPal order" };
  }
}

async function runPayPalGetOrderStatus(rawArguments) {
  let args = {};
  try {
    args = JSON.parse(rawArguments);
  } catch {
    return { ok: false, reason: "Could not read tool arguments" };
  }

  const order = await paypalGetOrder(args.orderId);
  if (!order) return { ok: false, reason: "Order not found" };

  return {
    ok: true,
    orderId: order.id,
    status: order.status,
  };
}

// userMessages: already validated list of { role: "user" | "assistant", content }
export async function runAssistant(userMessages, context = {}) {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...userMessages];
  const proposals = [];

  for (let round = 0; round < 4; round++) {
    const reply = await askModel(messages);

    if (!reply.tool_calls?.length) {
      return { reply: reply.content ?? "", proposals };
    }

    messages.push(reply);
    for (const call of reply.tool_calls) {
      let result;
      if (call.function.name === "search_products") {
        result = await runSearchProducts(call.function.arguments);
      } else if (call.function.name === "propose_booking") {
        result = await runProposeBooking(call.function.arguments, proposals);
      } else if (call.function.name === "paypal_create_invoice") {
        result = await runPayPalCreateInvoice(call.function.arguments, context);
      } else if (call.function.name === "paypal_get_invoice") {
        result = await runPayPalGetInvoice(call.function.arguments);
      } else if (call.function.name === "paypal_create_order") {
        result = await runPayPalCreateOrder(call.function.arguments, context);
      } else if (call.function.name === "paypal_get_order_status") {
        result = await runPayPalGetOrderStatus(call.function.arguments);
      } else {
        result = { error: "Unknown tool" };
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return {
    reply: "I couldn't finish that request. Could you try asking in a simpler way?",
    proposals,
  };
}