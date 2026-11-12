import { runAssistant } from "../services/assistantService.js";

export async function chat(req, res) {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 10) {
    return res.status(400).json({ message: "Send between 1 and 10 messages" });
  }

  const clean = [];
  for (const m of messages) {
    const validRole = m && (m.role === "user" || m.role === "assistant");
    const validText =
      m && typeof m.content === "string" && m.content.trim() !== "" && m.content.length <= 500;
    if (!validRole || !validText) {
      return res.status(400).json({ message: "Each message needs a role of user or assistant, and 1 to 500 characters of text" });
    }
    clean.push({ role: m.role, content: m.content.trim() });
  }

  if (clean[clean.length - 1].role !== "user") {
    return res.status(400).json({ message: "The last message must be from the user" });
  }

  try {
    const { reply, proposals } = await runAssistant(clean, { user: req.user });
    return res.json({ reply, proposals });
  } catch (err) {
    console.error("Assistant error:", err.message);
    return res.status(503).json({ message: "The assistant is unavailable right now. Please try again in a minute." });
  }
}