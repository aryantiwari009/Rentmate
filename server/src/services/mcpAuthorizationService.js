import mongoose from "mongoose";
import { Invoice } from "../models/Invoice.js";
import { Booking } from "../models/Booking.js";
import { callPayPalMcpTool } from "./paypalMcpService.js";

/**
 * Allowed MCP tools for regular authenticated customers.
 * High-risk or merchant-wide administrative tools are blocked.
 */
export const CUSTOMER_ALLOWED_MCP_TOOLS = new Set([
  "list_invoices",
  "get_invoice",
  "send_invoice",
  "send_invoice_reminder",
  "cancel_sent_invoice",
  "create_order",
  "get_order",
  "create_refund",
  "get_refund",
]);

/**
 * Checks whether an invoice belongs to the authenticated user.
 */
export async function verifyInvoiceAccess(invoiceId, userId, isAdmin = false) {
  if (!invoiceId || !userId) return false;
  if (isAdmin) return true;

  const userObjectId = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null;
  if (!userObjectId) return false;

  // 1. Check Invoice record
  const dbInvoice = await Invoice.findOne({ invoiceId });
  if (dbInvoice) {
    if (dbInvoice.user && dbInvoice.user.toString() === userId.toString()) {
      return true;
    }
    if (dbInvoice.booking) {
      const b = await Booking.findOne({ _id: dbInvoice.booking, user: userObjectId });
      if (b) return true;
    }
    return false;
  }

  // 2. Check Booking record if invoice not yet indexed in Invoice collection
  const dbBooking = await Booking.findOne({ paypalInvoiceId: invoiceId, user: userObjectId });
  return !!dbBooking;
}

/**
 * Retrieves all PayPal invoice IDs authorized for a given user.
 */
export async function getUserAuthorizedInvoiceIds(userId) {
  if (!userId || !mongoose.isValidObjectId(userId)) return [];

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const [invoices, bookings] = await Promise.all([
    Invoice.find({ user: userObjectId }).select("invoiceId").lean(),
    Booking.find({
      user: userObjectId,
      paypalInvoiceId: { $exists: true, $ne: null },
    })
      .select("paypalInvoiceId")
      .lean(),
  ]);

  const idSet = new Set();
  for (const inv of invoices) {
    if (inv.invoiceId) idSet.add(inv.invoiceId);
  }
  for (const b of bookings) {
    if (b.paypalInvoiceId) idSet.add(b.paypalInvoiceId);
  }

  return Array.from(idSet);
}

/**
 * Checks whether a booking belongs to the authenticated user.
 */
export async function verifyBookingAccess(bookingId, userId, isAdmin = false) {
  if (!bookingId || !userId || !mongoose.isValidObjectId(bookingId)) return null;
  if (isAdmin) {
    return Booking.findById(bookingId).populate("product");
  }
  return Booking.findOne({ _id: bookingId, user: userId }).populate("product");
}

/**
 * Checks whether an order belongs to the authenticated user.
 */
export async function verifyOrderAccess(orderId, userId, isAdmin = false) {
  if (!orderId || !userId) return false;
  if (isAdmin) return true;

  const userObjectId = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null;
  if (!userObjectId) return false;

  const booking = await Booking.findOne({ paypalOrderId: orderId, user: userObjectId });
  return !!booking;
}

/**
 * Checks whether a refund/capture belongs to the authenticated user.
 */
export async function verifyRefundAccess(captureOrRefundId, userId, isAdmin = false) {
  if (!captureOrRefundId || !userId) return false;
  if (isAdmin) return true;

  const userObjectId = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null;
  if (!userObjectId) return false;

  const booking = await Booking.findOne({ paypalCaptureId: captureOrRefundId, user: userObjectId });
  return !!booking;
}

/**
 * Formats and sanitizes a PayPal invoice object so other customers' PII is never exposed.
 */
export function sanitizeInvoiceData(inv, contextUser) {
  if (!inv) return null;
  const curr = inv.amount?.currency_code || "USD";
  const symbol = curr === "USD" ? "$" : curr === "INR" ? "₹" : "";
  const val = inv.amount?.value || 0;

  return {
    id: inv.id,
    invoiceNumber: inv.detail?.invoice_number || inv.invoiceNumber,
    status: inv.status,
    amount: val,
    dueAmount: inv.due_amount?.value || "0.00",
    currency: curr,
    formattedAmount: `${symbol}${val} ${curr}`.trim(),
    invoiceDate: inv.detail?.invoice_date,
    viewUrl:
      inv.detail?.metadata?.recipient_view_url ||
      inv.detail?.metadata?.payer_view_url ||
      (inv.id ? `https://www.sandbox.paypal.com/invoice/p/#${inv.id}` : null),
    // Strictly isolate recipient data to the authenticated user
    recipient: contextUser?.email || "Authenticated Tenant",
  };
}

/**
 * Executes a PayPal MCP tool with strict authorization and data isolation.
 */
export async function executeAuthorizedMcpTool(toolName, args = {}, context = {}) {
  const user = context?.user;
  const userId = user?._id ? String(user._id) : null;
  const isAdmin = user?.role === "admin";

  if (!userId) {
    return { ok: false, error: "Authentication required to access payment and invoice tools." };
  }

  // 1. Enforce tool allowlist
  if (!isAdmin && !CUSTOMER_ALLOWED_MCP_TOOLS.has(toolName)) {
    console.warn(`[Security Alert] Blocked restricted MCP tool execution: User ${userId} tried to call ${toolName}`);
    return { ok: false, error: `Forbidden: The '${toolName}' tool is restricted to administrators.` };
  }

  // 2. list_invoices: Query RentMate MongoDB for user invoices, then fetch live MCP status only for authorized IDs
  if (toolName === "list_invoices") {
    const authorizedIds = await getUserAuthorizedInvoiceIds(userId);
    if (!authorizedIds.length) {
      return {
        total: 0,
        invoices: [],
        message: "You have no invoices associated with your account.",
      };
    }

    // Retrieve live details for up to 5 authorized invoices
    const sliceIds = authorizedIds.slice(0, 5);
    const invoiceList = [];

    for (const invId of sliceIds) {
      let added = false;
      try {
        const rawInv = await callPayPalMcpTool("get_invoice", { invoice_id: invId });
        if (rawInv && rawInv.id && !rawInv.error && !rawInv.name?.includes("NOT_FOUND")) {
          invoiceList.push(sanitizeInvoiceData(rawInv, user));
          added = true;
        }
      } catch (err) {
        // proceed to local fallback
      }

      if (!added) {
        // Fallback to local DB invoice if MCP fetch fails or invoice is local
        const localInv = await Invoice.findOne({ invoiceId: invId }).lean();
        if (localInv) {
          const curr = localInv.currency || "USD";
          const symbol = curr === "USD" ? "$" : curr === "INR" ? "₹" : "";
          invoiceList.push({
            id: localInv.invoiceId,
            invoiceNumber: localInv.invoiceNumber,
            status: localInv.status,
            amount: localInv.amount,
            dueAmount: localInv.status === "PAID" ? "0.00" : String(localInv.amount || 0),
            currency: curr,
            formattedAmount: `${symbol}${localInv.amount} ${curr}`.trim(),
            viewUrl: localInv.invoiceUrl,
            recipient: user.email,
          });
        }
      }
    }

    return {
      total: authorizedIds.length,
      invoices: invoiceList,
    };
  }

  // 3. get_invoice: Verify ownership before calling PayPal MCP
  if (toolName === "get_invoice") {
    const targetInvoiceId = args.invoice_id || args.invoiceId || args.id;
    if (!targetInvoiceId) {
      return { ok: false, error: "Invoice ID is required." };
    }

    const hasAccess = await verifyInvoiceAccess(targetInvoiceId, userId, isAdmin);
    if (!hasAccess) {
      console.warn(`[Security Alert] Blocked unauthorized invoice access: User ${userId} attempted to access invoice ${targetInvoiceId}`);
      return { ok: false, error: "Unauthorized: You do not have permission to access this invoice." };
    }

    let rawResult = null;
    try {
      rawResult = await callPayPalMcpTool("get_invoice", { invoice_id: targetInvoiceId });
    } catch (_) {}

    if (rawResult && rawResult.id && !rawResult.error && !rawResult.name?.includes("NOT_FOUND")) {
      return sanitizeInvoiceData(rawResult, user);
    }

    // Fallback to local DB invoice if MCP fetch does not find it or fails
    const localInv = await Invoice.findOne({ invoiceId: targetInvoiceId }).lean();
    if (localInv) {
      const curr = localInv.currency || "USD";
      const symbol = curr === "USD" ? "$" : curr === "INR" ? "₹" : "";
      return {
        id: localInv.invoiceId,
        invoiceNumber: localInv.invoiceNumber,
        status: localInv.status,
        amount: localInv.amount,
        dueAmount: localInv.status === "PAID" ? "0.00" : String(localInv.amount || 0),
        currency: curr,
        formattedAmount: `${symbol}${localInv.amount} ${curr}`.trim(),
        viewUrl: localInv.invoiceUrl,
        recipient: user.email,
      };
    }

    return { ok: false, error: "Invoice not found." };
  }

  // 4. send_invoice & send_invoice_reminder
  if (toolName === "send_invoice" || toolName === "send_invoice_reminder") {
    const targetInvoiceId = args.invoice_id || args.invoiceId || args.id;
    if (!targetInvoiceId) {
      return { ok: false, error: "Invoice ID is required." };
    }

    const hasAccess = await verifyInvoiceAccess(targetInvoiceId, userId, isAdmin);
    if (!hasAccess) {
      console.warn(`[Security Alert] Blocked unauthorized invoice modification: User ${userId} attempted ${toolName} on invoice ${targetInvoiceId}`);
      return { ok: false, error: "Unauthorized: You do not have permission to modify this invoice." };
    }

    return await callPayPalMcpTool(toolName, { invoice_id: targetInvoiceId });
  }

  // 5. cancel_sent_invoice: Requires ownership + explicit user confirmation
  if (toolName === "cancel_sent_invoice") {
    const targetInvoiceId = args.invoice_id || args.invoiceId || args.id;
    if (!targetInvoiceId) {
      return { ok: false, error: "Invoice ID is required." };
    }

    const hasAccess = await verifyInvoiceAccess(targetInvoiceId, userId, isAdmin);
    if (!hasAccess) {
      console.warn(`[Security Alert] Blocked unauthorized invoice cancellation: User ${userId} attempted to cancel invoice ${targetInvoiceId}`);
      return { ok: false, error: "Unauthorized: You do not have permission to cancel this invoice." };
    }

    if (!args.confirmed) {
      return {
        ok: false,
        requiresConfirmation: true,
        message: `Cancelling invoice ${targetInvoiceId} requires explicit confirmation. Please confirm you want to cancel this invoice.`,
      };
    }

    return await callPayPalMcpTool("cancel_sent_invoice", {
      invoice_id: targetInvoiceId,
      subject: args.subject || "Invoice cancelled by user request",
      note: args.note || "Cancelled via RentMate Assistant",
      send_to_recipient: false,
    });
  }

  // 6. get_order
  if (toolName === "get_order") {
    const orderId = args.order_id || args.orderId || args.id;
    if (!orderId) {
      return { ok: false, error: "Order ID is required." };
    }

    const hasAccess = await verifyOrderAccess(orderId, userId, isAdmin);
    if (!hasAccess) {
      console.warn(`[Security Alert] Blocked unauthorized order access: User ${userId} attempted to view order ${orderId}`);
      return { ok: false, error: "Unauthorized: You do not have permission to view this order." };
    }

    const rawOrder = await callPayPalMcpTool("get_order", { order_id: orderId });
    const curr = rawOrder.purchase_units?.[0]?.amount?.currency_code || "USD";
    const symbol = curr === "USD" ? "$" : curr === "INR" ? "₹" : "";
    const val = rawOrder.purchase_units?.[0]?.amount?.value || 0;

    return {
      id: rawOrder.id,
      status: rawOrder.status,
      intent: rawOrder.intent,
      amount: val,
      currency: curr,
      formattedAmount: `${symbol}${val} ${curr}`.trim(),
    };
  }

  // 7. create_order: Requires valid user-owned booking
  if (toolName === "create_order") {
    const bookingId = args.booking_id || args.bookingId;
    const booking = await verifyBookingAccess(bookingId, userId, isAdmin);
    if (!booking) {
      return { ok: false, error: "Booking not found or not owned by your account." };
    }

    return await callPayPalMcpTool("create_order", args);
  }

  // 8. create_refund: Requires ownership + explicit confirmation
  if (toolName === "create_refund") {
    const captureId = args.capture_id || args.captureId;
    if (!captureId) {
      return { ok: false, error: "Capture ID is required for refund." };
    }

    const hasAccess = await verifyRefundAccess(captureId, userId, isAdmin);
    if (!hasAccess) {
      console.warn(`[Security Alert] Blocked unauthorized refund: User ${userId} attempted to refund capture ${captureId}`);
      return { ok: false, error: "Unauthorized: You do not have permission to refund this transaction." };
    }

    if (!args.confirmed) {
      return {
        ok: false,
        requiresConfirmation: true,
        message: "Issuing a refund requires explicit confirmation. Please confirm you wish to issue this refund.",
      };
    }

    return await callPayPalMcpTool("create_refund", args);
  }

  // 9. get_refund: Requires ownership
  if (toolName === "get_refund") {
    const refundId = args.refund_id || args.refundId;
    if (!refundId) {
      return { ok: false, error: "Refund ID is required." };
    }

    const hasAccess = await verifyRefundAccess(refundId, userId, isAdmin);
    if (!hasAccess) {
      return { ok: false, error: "Unauthorized: You do not have permission to access this refund." };
    }

    return await callPayPalMcpTool("get_refund", { refund_id: refundId });
  }

  // Fallback for any other tools (admins only)
  if (isAdmin) {
    return await callPayPalMcpTool(toolName, args);
  }

  return { ok: false, error: "Operation not permitted." };
}
