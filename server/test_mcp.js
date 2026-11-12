import { listPayPalMcpTools, callPayPalMcpTool, closePayPalMcpClient } from "./src/services/paypalMcpService.js";
import { runAssistant } from "./src/services/assistantService.js";

async function runTests() {
  console.log("=== [1/3] Testing PayPal MCP Connection & Tool Discovery ===");
  const tools = await listPayPalMcpTools();
  if (!tools || tools.length === 0) {
    throw new Error("No tools discovered from PayPal MCP Server");
  }
  console.log(`✓ Successfully discovered ${tools.length} official PayPal MCP tools`);

  console.log("\n=== [2/3] Testing Direct PayPal MCP Tool Execution ===");
  const invoices = await callPayPalMcpTool("list_invoices", { page: 1, page_size: 2 });
  if (!invoices || !Array.isArray(invoices.items)) {
    throw new Error("Failed to list invoices from PayPal MCP Server");
  }
  console.log(`✓ Successfully retrieved ${invoices.items.length} invoice(s) via PayPal MCP`);

  console.log("\n=== [3/3] Testing Groq AI Assistant + PayPal MCP Bridge ===");
  const res = await runAssistant([
    { role: "user", content: "List my recent PayPal invoices using MCP tools." },
  ]);
  if (!res.reply || res.reply.length === 0) {
    throw new Error("Empty assistant response");
  }
  console.log("✓ Assistant successfully bridged Groq and PayPal MCP:\n", res.reply);

  await closePayPalMcpClient();
  console.log("\n=== ALL PAYPAL MCP TESTS PASSED ===");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("MCP test failed:", err);
  process.exit(1);
});
