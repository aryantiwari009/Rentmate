import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { getAccessToken } from "./paypal.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mcpClientInstance = null;
let mcpTransportInstance = null;
let cachedTools = null;
let isConnecting = false;

/**
 * Resolves the path to the official @paypal/mcp entry point.
 */
function getMcpServerScriptPath() {
  // In server runtime, resolve relative to server root
  const localPath = path.resolve(__dirname, "../../node_modules/@paypal/mcp/dist/index.js");
  return localPath;
}

/**
 * Initializes and connects to the official PayPal MCP Server over stdio.
 */
export async function getPayPalMcpClient() {
  if (mcpClientInstance && mcpTransportInstance) {
    return mcpClientInstance;
  }

  if (isConnecting) {
    // Wait briefly if another call is currently initializing
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 200));
      if (mcpClientInstance) return mcpClientInstance;
    }
  }

  isConnecting = true;

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error("Unable to obtain PayPal OAuth token for MCP server");
    }

    const mcpScript = getMcpServerScriptPath();
    const isSandbox = (process.env.PAYPAL_API || "").includes("sandbox") ||
      (process.env.NODE_ENV !== "production" && !process.env.PAYPAL_API?.includes("api-m.paypal.com"));

    const env = {
      ...process.env,
      PAYPAL_ACCESS_TOKEN: accessToken,
      PAYPAL_ENVIRONMENT: isSandbox ? "SANDBOX" : "PRODUCTION",
    };

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [mcpScript, "--tools=all"],
      env,
    });

    const client = new Client(
      {
        name: "rentmate-mcp-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);
    console.log("[PayPal MCP] Successfully connected to official PayPal MCP Server via stdio");

    mcpClientInstance = client;
    mcpTransportInstance = transport;

    // Discover and cache tools
    const toolsResult = await client.listTools();
    cachedTools = toolsResult?.tools || [];
    console.log(`[PayPal MCP] Discovered ${cachedTools.length} official PayPal tools`);

    return mcpClientInstance;
  } catch (err) {
    console.error("[PayPal MCP] Failed to initialize PayPal MCP connection:", err.message);
    mcpClientInstance = null;
    mcpTransportInstance = null;
    cachedTools = null;
    throw err;
  } finally {
    isConnecting = false;
  }
}

/**
 * Lists all available PayPal tools from the official MCP Server.
 */
export async function listPayPalMcpTools() {
  try {
    if (cachedTools && cachedTools.length > 0) {
      return cachedTools;
    }
    const client = await getPayPalMcpClient();
    const result = await client.listTools();
    cachedTools = result?.tools || [];
    return cachedTools;
  } catch (err) {
    console.warn("[PayPal MCP] Tool discovery warning:", err.message);
    return [];
  }
}

/**
 * Executes a tool on the official PayPal MCP Server.
 */
export async function callPayPalMcpTool(name, args = {}) {
  const client = await getPayPalMcpClient();
  const response = await client.callTool({
    name,
    arguments: args,
  });

  // Extract and format the content returned by MCP
  if (response?.content && Array.isArray(response.content)) {
    const textItem = response.content.find((c) => c.type === "text");
    if (textItem?.text) {
      try {
        return JSON.parse(textItem.text);
      } catch {
        return { text: textItem.text };
      }
    }
    return response.content;
  }

  return response;
}

/**
 * Converts an official MCP Tool schema into an OpenAI/Groq function calling declaration.
 */
export function mcpToolToOpenAiFunction(mcpTool) {
  return {
    type: "function",
    function: {
      name: `mcp_${mcpTool.name}`,
      description: `[Official PayPal MCP Tool] ${mcpTool.description?.trim() || mcpTool.name}`,
      parameters: mcpTool.inputSchema || {
        type: "object",
        properties: {},
      },
    },
  };
}

/**
 * Gracefully disconnects the MCP client.
 */
export async function closePayPalMcpClient() {
  if (mcpClientInstance) {
    try {
      await mcpClientInstance.close();
    } catch (_) {}
    mcpClientInstance = null;
    mcpTransportInstance = null;
    cachedTools = null;
  }
}
