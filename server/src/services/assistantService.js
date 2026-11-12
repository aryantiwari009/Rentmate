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
import { calculateBookingBreakdown } from "../utils/currency.js";
import {
  listPayPalMcpTools,
  callPayPalMcpTool,
  mcpToolToOpenAiFunction,
} from "./paypalMcpService.js";

const SYSTEM_PROMPT =
  "You are RentMate's official PayPal AI rental assistant, equipped with the official PayPal MCP Server. " +
  "You help users search items to rent by the month, check pricing and availability, prepare bookings, and manage real PayPal invoices, payments, and orders. " +
  "Use search_products to find real items in the catalog. " +
  "When the user has chosen an item, a start date and months, call propose_booking to check real price and prepare a proposal card. " +
  "You can use official PayPal MCP tools (such as mcp_list_invoices, mcp_get_invoice, mcp_create_invoice, mcp_create_order, mcp_get_order) to inspect or manage PayPal transactions. " +
  "Always confirm pricing and booking details with the user before initiating any new invoice or order creation. " +
  "Prices are in Indian Rupees (INR) for rental displays and converted to USD for PayPal sandbox transactions. " +
  "Currency formatting: Always format USD amounts using $ (e.g. $25.86 USD). Always format INR amounts using ₹ (e.g. ₹2,198 INR). Never prefix USD amounts with ₹ (never write '₹ ... USD'). " +
  "Answer in concise, natural, helpful text without raw markdown symbols or fake buttons.";

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

async function askModel(messages, activeTools = tools) {
  const response = await fetch(`${process.env.AI_BASE_URL}chat/completions`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.AI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: process.env.AI_MODEL, messages, tools: activeTools }),
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
    let invoiceUrl = created?.detail?.metadata?.recipient_view_url || created?.detail?.metadata?.payer_view_url;
    try {
      await paypalSendInvoice(invoiceId);
      const detailed = await paypalGetInvoice(invoiceId);
      if (detailed?.detail?.metadata?.recipient_view_url || detailed?.detail?.metadata?.payer_view_url) {
        invoiceUrl = detailed.detail.metadata.recipient_view_url || detailed.detail.metadata.payer_view_url;
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
    invoiceUrl: invoice.detail?.metadata?.recipient_view_url || invoice.detail?.metadata?.payer_view_url,
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

  const breakdown = calculateBookingBreakdown(booking);
  const amount = breakdown.totalTarget.toFixed(2);
  const currency = breakdown.currency;

  try {
    const order = await paypalCreateOrder({
      amount,
      currency,
      bookingId: booking._id.toString(),
      description: `RentMate Booking #${booking._id}`,
    });

    booking.paypalOrderId = order.id;
    booking.exchangeRate = breakdown.conversionRate;
    booking.chargedAmount = breakdown.totalTarget;
    booking.chargedCurrency = currency;
    await booking.save();

    return {
      ok: true,
      orderId: order.id,
      status: order.status,
      amount,
      currency,
      exchangeRate: breakdown.conversionRate,
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

function formatMcpResult(toolName, result) {
  if (!result) return { ok: false, reason: "No data returned from PayPal MCP" };
  if (result.error) return result;

  // Format list_invoices cleanly to minimize token consumption
  if (toolName === "list_invoices" && Array.isArray(result.items)) {
    return {
      total: result.total_count || result.items.length,
      invoices: result.items.slice(0, 5).map((inv) => {
        const symbol = inv.amount?.currency_code === "USD" ? "$" : inv.amount?.currency_code === "INR" ? "₹" : "";
        return {
          id: inv.id,
          invoiceNumber: inv.detail?.invoice_number,
          status: inv.status,
          amount: inv.amount?.value,
          dueAmount: inv.due_amount?.value,
          currency: inv.amount?.currency_code,
          formattedAmount: `${symbol}${inv.amount?.value || 0} ${inv.amount?.currency_code || ""}`.trim(),
          recipient: inv.primary_recipients?.[0]?.billing_info?.email_address,
        };
      }),
    };
  }

  // Format get_invoice cleanly
  if (toolName === "get_invoice" && result.id) {
    const symbol = result.amount?.currency_code === "USD" ? "$" : result.amount?.currency_code === "INR" ? "₹" : "";
    return {
      id: result.id,
      invoiceNumber: result.detail?.invoice_number,
      status: result.status,
      amount: result.amount?.value,
      dueAmount: result.due_amount?.value,
      currency: result.amount?.currency_code,
      formattedAmount: `${symbol}${result.amount?.value || 0} ${result.amount?.currency_code || ""}`.trim(),
      note: result.detail?.note,
      invoiceDate: result.detail?.invoice_date,
      viewUrl: result.detail?.metadata?.recipient_view_url || result.detail?.metadata?.payer_view_url,
      recipient: result.primary_recipients?.[0]?.billing_info?.email_address,
    };
  }

  // Format get_order cleanly
  if (toolName === "get_order" && result.id) {
    const symbol = result.purchase_units?.[0]?.amount?.currency_code === "USD" ? "$" : result.purchase_units?.[0]?.amount?.currency_code === "INR" ? "₹" : "";
    return {
      id: result.id,
      status: result.status,
      intent: result.intent,
      amount: result.purchase_units?.[0]?.amount?.value,
      currency: result.purchase_units?.[0]?.amount?.currency_code,
      formattedAmount: `${symbol}${result.purchase_units?.[0]?.amount?.value || 0} ${result.purchase_units?.[0]?.amount?.currency_code || ""}`.trim(),
    };
  }

  return result;
}

// userMessages: already validated list of { role: "user" | "assistant", content }
export async function runAssistant(userMessages, context = {}) {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...userMessages];
  const proposals = [];

  let activeTools = [...tools];
  let mcpTools = [];

  try {
    const rawMcpTools = await listPayPalMcpTools();
    if (rawMcpTools && rawMcpTools.length > 0) {
      // Focus on essential commerce, invoice, and payment tools to stay well within Groq TPM limits
      const allowedToolNames = new Set([
        "get_invoice",
        "list_invoices",
        "send_invoice",
        "get_order",
        "create_order",
        "create_refund",
        "get_refund",
      ]);

      mcpTools = rawMcpTools.filter((t) => allowedToolNames.has(t.name));
      const mcpFunctions = mcpTools.map(mcpToolToOpenAiFunction);
      activeTools = [...tools, ...mcpFunctions];
    }
  } catch (mcpErr) {
    console.warn(
      "[Assistant] Warning: Unable to load MCP tools dynamically, continuing with base tools:",
      mcpErr.message
    );
  }

  for (let round = 0; round < 4; round++) {
    const reply = await askModel(messages, activeTools);

    if (!reply.tool_calls?.length) {
      return { reply: reply.content ?? "", proposals };
    }

    messages.push(reply);
    for (const call of reply.tool_calls) {
      const fnName = call.function.name;
      let result;

      // 1. Check if tool is an official PayPal MCP tool (prefixed with mcp_)
      if (fnName.startsWith("mcp_")) {
        const rawMcpName = fnName.slice(4);
        let parsedArgs = {};
        try {
          parsedArgs = JSON.parse(call.function.arguments || "{}");
        } catch {
          parsedArgs = {};
        }

        try {
          console.log(`[Assistant] Invoking official PayPal MCP tool: ${rawMcpName}`, parsedArgs);
          const rawResult = await callPayPalMcpTool(rawMcpName, parsedArgs);
          result = formatMcpResult(rawMcpName, rawResult);
        } catch (mcpCallErr) {
          console.error(`[Assistant] PayPal MCP tool execution error for ${rawMcpName}:`, mcpCallErr.message);
          result = { error: `PayPal MCP tool error: ${mcpCallErr.message}` };
        }
      }
      // 2. Base RentMate catalog & pricing tools
      else if (fnName === "search_products") {
        result = await runSearchProducts(call.function.arguments);
      } else if (fnName === "propose_booking") {
        result = await runProposeBooking(call.function.arguments, proposals);
      }
      // 3. Fallback direct PayPal tools
      else if (fnName === "paypal_create_invoice") {
        result = await runPayPalCreateInvoice(call.function.arguments, context);
      } else if (fnName === "paypal_get_invoice") {
        result = await runPayPalGetInvoice(call.function.arguments);
      } else if (fnName === "paypal_create_order") {
        result = await runPayPalCreateOrder(call.function.arguments, context);
      } else if (fnName === "paypal_get_order_status") {
        result = await runPayPalGetOrderStatus(call.function.arguments);
      }
      // 4. Raw MCP tool name without mcp_ prefix
      else {
        const isRawMcp = mcpTools.some((t) => t.name === fnName);
        if (isRawMcp) {
          try {
            const parsedArgs = JSON.parse(call.function.arguments || "{}");
            console.log(`[Assistant] Invoking raw PayPal MCP tool: ${fnName}`, parsedArgs);
            const rawResult = await callPayPalMcpTool(fnName, parsedArgs);
            result = formatMcpResult(fnName, rawResult);
          } catch (rawErr) {
            result = { error: `PayPal MCP tool error: ${rawErr.message}` };
          }
        } else {
          result = { error: "Unknown tool" };
        }
      }

      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return {
    reply: "I couldn't finish that request. Could you try asking in a simpler way?",
    proposals,
  };
}