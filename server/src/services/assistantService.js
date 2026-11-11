import { Product } from "../models/Product.js";
import { buildProductFilter } from "./productSearch.js";
import { prepareBooking } from "./bookingService.js";

const SYSTEM_PROMPT =
  "You are RentMate's rental assistant. Help people find items to rent by the month. " +
  "Use search_products to find real items, and only recommend items it returns. " +
  "When the user has chosen an item, a start date and a number of months, call propose_booking. " +
  "You never confirm or create bookings yourself: the user confirms with a button. " +
  "Never work out prices yourself. Quote only the numbers that tools return. " +
  "Prices are in rupees. Answer in short plain text, with no tables." +
  "Never write buttons, links or markdown. The app shows its own Confirm button.";

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

// userMessages: already validated list of { role: "user" | "assistant", content }
export async function runAssistant(userMessages) {
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