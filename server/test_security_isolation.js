import mongoose from "mongoose";
import { User } from "./src/models/User.js";
import { Invoice } from "./src/models/Invoice.js";
import { Booking } from "./src/models/Booking.js";
import { Product } from "./src/models/Product.js";
import {
  executeAuthorizedMcpTool,
  verifyInvoiceAccess,
  verifyOrderAccess,
  verifyBookingAccess,
  verifyRefundAccess,
} from "./src/services/mcpAuthorizationService.js";
import { runAssistant } from "./src/services/assistantService.js";
import { closePayPalMcpClient } from "./src/services/paypalMcpService.js";

async function runSecurityTests() {
  console.log("===============================================================");
  console.log("   RENTMATE PAYPAL MCP SECURITY & CROSS-USER ISOLATION AUDIT   ");
  console.log("===============================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  // Clean up any old test users
  const emailA = "test_sec_user_a@rentmate.test";
  const emailB = "test_sec_user_b@rentmate.test";
  const emailC = "test_sec_user_c@rentmate.test";

  await User.deleteMany({ email: { $in: [emailA, emailB, emailC] } });
  await Invoice.deleteMany({
    invoiceId: {
      $in: [
        "INV2-SEC-TEST-A1",
        "INV2-SEC-TEST-A2",
        "INV2-SEC-TEST-B1",
        "INV2-SEC-TEST-B2",
      ],
    },
  });
  await Booking.deleteMany({
    paypalInvoiceId: {
      $in: [
        "INV2-SEC-TEST-A1",
        "INV2-SEC-TEST-A2",
        "INV2-SEC-TEST-B1",
        "INV2-SEC-TEST-B2",
      ],
    },
  });

  // 1. Create two separate RentMate users
  const userA = await User.create({
    name: "Aryan (User A)",
    email: emailA,
    passwordHash: "dummyHashForTest1234",
    role: "user",
  });

  const userB = await User.create({
    name: "Rahul (User B)",
    email: emailB,
    passwordHash: "dummyHashForTest1234",
    role: "user",
  });

  const userC = await User.create({
    name: "Charlie (User C - No Invoices)",
    email: emailC,
    passwordHash: "dummyHashForTest1234",
    role: "user",
  });

  console.log(`Created test users:\n  User A: ${userA._id} (${userA.email})\n  User B: ${userB._id} (${userB.email})\n  User C: ${userC._id} (${userC.email})\n`);

  // 2. Create 2 invoices for User A
  await Invoice.create({
    invoiceId: "INV2-SEC-TEST-A1",
    invoiceNumber: "INV-A1-001",
    user: userA._id,
    recipientEmail: userA.email,
    recipientName: userA.name,
    amount: 25.0,
    currency: "USD",
    status: "PAID",
    invoiceUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-SEC-TEST-A1",
  });

  await Invoice.create({
    invoiceId: "INV2-SEC-TEST-A2",
    invoiceNumber: "INV-A2-002",
    user: userA._id,
    recipientEmail: userA.email,
    recipientName: userA.name,
    amount: 50.0,
    currency: "USD",
    status: "SENT",
    invoiceUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-SEC-TEST-A2",
  });

  // 3. Create 2 invoices for User B
  await Invoice.create({
    invoiceId: "INV2-SEC-TEST-B1",
    invoiceNumber: "INV-B1-001",
    user: userB._id,
    recipientEmail: userB.email,
    recipientName: userB.name,
    amount: 100.0,
    currency: "USD",
    status: "PAID",
    invoiceUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-SEC-TEST-B1",
  });

  await Invoice.create({
    invoiceId: "INV2-SEC-TEST-B2",
    invoiceNumber: "INV-B2-002",
    user: userB._id,
    recipientEmail: userB.email,
    recipientName: userB.name,
    amount: 150.0,
    currency: "USD",
    status: "SENT",
    invoiceUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-SEC-TEST-B2",
  });

  console.log("Seeded 2 invoices for User A and 2 invoices for User B.\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      process.exitCode = 1;
    }
  }

  // --- TEST 1: User A lists invoices ---
  console.log("=== Test 1: User A lists invoices ===");
  const resA = await executeAuthorizedMcpTool("list_invoices", {}, { user: userA });
  const idsA = resA.invoices?.map((i) => i.id) || [];
  assert(
    idsA.includes("INV2-SEC-TEST-A1") && idsA.includes("INV2-SEC-TEST-A2"),
    "User A sees their own two invoices"
  );
  assert(
    !idsA.includes("INV2-SEC-TEST-B1") && !idsA.includes("INV2-SEC-TEST-B2"),
    "User A DOES NOT see User B's invoices"
  );
  assert(
    resA.invoices?.every((i) => i.recipient === userA.email),
    "All invoices returned to User A have recipient scoped strictly to User A"
  );

  // --- TEST 2: User B lists invoices ---
  console.log("\n=== Test 2: User B lists invoices ===");
  const resB = await executeAuthorizedMcpTool("list_invoices", {}, { user: userB });
  const idsB = resB.invoices?.map((i) => i.id) || [];
  assert(
    idsB.includes("INV2-SEC-TEST-B1") && idsB.includes("INV2-SEC-TEST-B2"),
    "User B sees their own two invoices"
  );
  assert(
    !idsB.includes("INV2-SEC-TEST-A1") && !idsB.includes("INV2-SEC-TEST-A2"),
    "User B DOES NOT see User A's invoices"
  );
  assert(
    resB.invoices?.every((i) => i.recipient === userB.email),
    "All invoices returned to User B have recipient scoped strictly to User B"
  );

  // --- TEST 3: Cross-user direct retrieval (User A tries to get User B's invoice) ---
  console.log("\n=== Test 3: User A attempts to get User B's invoice by ID ===");
  const accessCheckAtoB = await verifyInvoiceAccess("INV2-SEC-TEST-B1", userA._id.toString());
  assert(!accessCheckAtoB, "verifyInvoiceAccess denies User A access to User B's invoice");

  const getResAtoB = await executeAuthorizedMcpTool(
    "get_invoice",
    { invoice_id: "INV2-SEC-TEST-B1" },
    { user: userA }
  );
  assert(
    getResAtoB.ok === false && getResAtoB.error?.includes("Unauthorized"),
    "executeAuthorizedMcpTool rejects User A's attempt with Unauthorized error"
  );

  // --- TEST 4: Cross-user direct retrieval (User B tries to get User A's invoice) ---
  console.log("\n=== Test 4: User B attempts to get User A's invoice by ID ===");
  const accessCheckBtoA = await verifyInvoiceAccess("INV2-SEC-TEST-A1", userB._id.toString());
  assert(!accessCheckBtoA, "verifyInvoiceAccess denies User B access to User A's invoice");

  const getResBtoA = await executeAuthorizedMcpTool(
    "get_invoice",
    { invoice_id: "INV2-SEC-TEST-A1" },
    { user: userB }
  );
  assert(
    getResBtoA.ok === false && getResBtoA.error?.includes("Unauthorized"),
    "executeAuthorizedMcpTool rejects User B's attempt with Unauthorized error"
  );

  // --- TEST 5: Unauthorized write/cancellation ---
  console.log("\n=== Test 5: Unauthorized invoice cancellation ===");
  const cancelRes = await executeAuthorizedMcpTool(
    "cancel_sent_invoice",
    { invoice_id: "INV2-SEC-TEST-B1", confirmed: true },
    { user: userA }
  );
  assert(
    cancelRes.ok === false && cancelRes.error?.includes("Unauthorized"),
    "User A cannot cancel User B's invoice"
  );

  // --- TEST 6: Unauthorized refund ---
  console.log("\n=== Test 6: Unauthorized refund ===");
  const refundRes = await executeAuthorizedMcpTool(
    "create_refund",
    { capture_id: "CAPTURE-XYZ-OTHER", confirmed: true },
    { user: userA }
  );
  assert(
    refundRes.ok === false && refundRes.error?.includes("Unauthorized"),
    "User A cannot issue a refund for an unowned capture"
  );

  // --- TEST 7: Restricted merchant-wide tools blocked for regular users ---
  console.log("\n=== Test 7: Block administrative/merchant-wide tools for regular users ===");
  const adminToolRes = await executeAuthorizedMcpTool(
    "list_transactions",
    {},
    { user: userA }
  );
  assert(
    adminToolRes.ok === false && adminToolRes.error?.includes("restricted to administrators"),
    "list_transactions is strictly blocked for non-admin users"
  );

  // --- TEST 8: User C with no invoices gets empty list ---
  console.log("\n=== Test 8: User with zero invoices ===");
  const resC = await executeAuthorizedMcpTool("list_invoices", {}, { user: userC });
  assert(
    resC.total === 0 && Array.isArray(resC.invoices) && resC.invoices.length === 0,
    "User C receives empty invoice array with total = 0"
  );

  // --- TEST 9: Full Assistant Chat Integration ---
  console.log("\n=== Test 9: Live AI Assistant Chat with User Context ===");
  try {
    const aiRes = await runAssistant(
      [{ role: "user", content: "Can you list my invoices please?" }],
      { user: userA }
    );
    console.log("   Assistant Reply to User A:\n   " + aiRes.reply.replace(/\n/g, "\n   "));

    assert(
      !aiRes.reply.includes(emailB) && !aiRes.reply.includes("INV-B1") && !aiRes.reply.includes("INV-B2"),
      "Assistant reply to User A NEVER mentions User B's email, invoices, or data"
    );
  } catch (err) {
    console.warn("   [Notice] AI assistant call skipped or failed:", err.message);
  }

  // Clean up
  await User.deleteMany({ email: { $in: [emailA, emailB, emailC] } });
  await Invoice.deleteMany({
    invoiceId: {
      $in: [
        "INV2-SEC-TEST-A1",
        "INV2-SEC-TEST-A2",
        "INV2-SEC-TEST-B1",
        "INV2-SEC-TEST-B2",
      ],
    },
  });

  await closePayPalMcpClient();
  await mongoose.disconnect();

  console.log(`\n===============================================================`);
  console.log(`   SECURITY AUDIT COMPLETE: ${passedTests}/${totalTests} TESTS PASSED   `);
  console.log(`===============================================================`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSecurityTests().catch((e) => {
  console.error("Test execution fatal error:", e);
  process.exit(1);
});
