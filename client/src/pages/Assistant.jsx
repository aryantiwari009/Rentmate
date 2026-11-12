import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  Home,
  PackageCheck,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { api } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import PayButton from "../components/PayButton.jsx";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const formatProposalDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

function Assistant() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([
    {
      id: "initial",
      role: "assistant",
      content:
        "Hello! I am your RentMate assistant. Tell me what you need, your budget, and when you would like to start renting. I can find products and prepare bookings for you.",
      proposals: [],
    },
  ]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [canRetry, setCanRetry] = useState(false);
  const [bookingStates, setBookingStates] = useState({});
  const latestMessageRef = useRef(null);
  const thinkingRef = useRef(null);

  useEffect(() => {
    if (sending) {
      thinkingRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }

    if (messages.length > 1) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "assistant") {
        latestMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        latestMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [messages, sending]);

  async function sendMessage(textToSend) {
    const text = (textToSend || query).trim();
    if (!text || sending) return;

    if (!user) {
      setError("Please sign in to chat with the assistant.");
      return;
    }

    const userMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setQuery("");
    setError(null);
    setCanRetry(false);
    setSending(true);

    const payload = nextMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, 500).trim(),
      }));

    try {
      const response = await api.post("/assistant/chat", { messages: payload });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: response.reply || "",
          proposals: Array.isArray(response.proposals) ? response.proposals : [],
        },
      ]);
    } catch (err) {
      let errorMsg = err.message || "Something went wrong";
      if (err.status === 401) {
        errorMsg = "Please sign in to chat with the assistant.";
      } else if (err.status === 429 || errorMsg.includes("Too many requests")) {
        errorMsg = "You are sending messages too quickly, please wait a minute";
      } else if (err.status === 503 || err.status === 500) {
        errorMsg = "The assistant is unavailable right now. Please try again in a minute.";
      }
      setError(errorMsg);
      setCanRetry(true);
    } finally {
      setSending(false);
    }
  }

  function retryLastMessage() {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      // Re-trigger sending with the existing message list
      const payload = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-10)
        .map((m) => ({
          role: m.role,
          content: m.content.slice(0, 500).trim(),
        }));

      setSending(true);
      setError(null);
      setCanRetry(false);

      api.post("/assistant/chat", { messages: payload })
        .then((response) => {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              content: response.reply || "",
              proposals: Array.isArray(response.proposals) ? response.proposals : [],
            },
          ]);
        })
        .catch((err) => {
          let errorMsg = err.message || "Something went wrong";
          if (err.status === 401) {
            errorMsg = "Please sign in to chat with the assistant.";
          } else if (err.status === 429 || errorMsg.includes("Too many requests")) {
            errorMsg = "You are sending messages too quickly, please wait a minute";
          } else if (err.status === 503 || err.status === 500) {
            errorMsg = "The assistant is unavailable right now. Please try again in a minute.";
          }
          setError(errorMsg);
          setCanRetry(true);
        })
        .finally(() => {
          setSending(false);
        });
    }
  }

  async function handleConfirmBooking(proposal) {
    const key = `${proposal.productId}-${proposal.startDate}-${proposal.months}`;
    setBookingStates((prev) => ({
      ...prev,
      [key]: { loading: true, error: null, success: false },
    }));

    try {
      const booking = await api.post("/bookings", {
        productId: proposal.productId,
        startDate: proposal.startDate,
        months: proposal.months,
      });

      setBookingStates((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          error: null,
          success: true,
          total: booking.total,
          booking,
        },
      }));
    } catch (err) {
      setBookingStates((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          error: err.message || "Failed to confirm booking",
          success: false,
        },
      }));
    }
  }

  return (
    <section className="page assistant-page">
      <div className="container assistant-container">
        <header className="page-header assistant-header">
          <span className="assistant-icon">
            <Sparkles size={26} aria-hidden="true" />
          </span>
          <h1>Your rental assistant</h1>
          <p>
            Tell me what you need, your budget and dates. I will find the right items
            and check availability directly from our live catalog.
          </p>
        </header>

        {!user && (
          <div
            className="alert alert-info"
            role="status"
            style={{
              marginBottom: "var(--s-4)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--s-2)",
            }}
          >
            <span>Please sign in to chat with the rental assistant.</span>
            <Link to="/login" state={{ from: "/assistant" }} className="btn btn-primary btn-sm">
              Sign in
            </Link>
          </div>
        )}

        <div className="chat-stream">
          {messages.map((msg, idx) => {
            const isLatest = idx === messages.length - 1;
            if (msg.role === "user") {
              return (
                <div
                  className="chat-message-user"
                  key={msg.id}
                  ref={isLatest ? latestMessageRef : null}
                >
                  <div className="chat-user-bubble">
                    {msg.content}
                  </div>
                </div>
              );
            }

            return (
              <div
                className="ai-answer"
                key={msg.id}
                ref={isLatest ? latestMessageRef : null}
              >
                <span className="ai-result-icon">
                  <Sparkles size={18} aria-hidden="true" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span>RentMate AI</span>
                  <p style={{ whiteSpace: "pre-wrap", margin: "var(--s-1) 0" }}>
                    {msg.content}
                  </p>

                  {Array.isArray(msg.proposals) && msg.proposals.length > 0 && (
                    <div className="proposal-list">
                      {msg.proposals.map((proposal) => {
                        const key = `${proposal.productId}-${proposal.startDate}-${proposal.months}`;
                        const bState = bookingStates[key];

                        return (
                          <div className="proposal-card" key={key}>
                            <div className="proposal-header">
                              <div className="proposal-title">
                                <PackageCheck size={18} aria-hidden="true" />
                                <h4>{proposal.productName}</h4>
                              </div>
                              <span className="proposal-badge">
                                {proposal.months} mo rental
                              </span>
                            </div>

                            <dl className="proposal-details">
                              <div>
                                <dt>Start date</dt>
                                <dd>{formatProposalDate(proposal.startDate)}</dd>
                              </div>
                              <div>
                                <dt>End date</dt>
                                <dd>{formatProposalDate(proposal.endDate)}</dd>
                              </div>
                              <div>
                                <dt>Duration</dt>
                                <dd>{proposal.months} month{proposal.months > 1 ? "s" : ""}</dd>
                              </div>
                              <div>
                                <dt>Monthly rent</dt>
                                <dd>{inr(proposal.monthlyRent)}/mo</dd>
                              </div>
                              <div>
                                <dt>Security deposit</dt>
                                <dd>{inr(proposal.deposit)}</dd>
                              </div>
                              <div className="proposal-total">
                                <dt>Total</dt>
                                <dd>{inr(proposal.total)}</dd>
                              </div>
                            </dl>

                            <p className="proposal-note">
                              Prices are confirmed by the server before you pay.
                            </p>

                            {bState?.success ? (
                              <div style={{ marginTop: "var(--s-3)" }}>
                                <div className="alert alert-success bookingSuccess">
                                  <CheckCircle2 size={18} aria-hidden="true" />
                                  <div>
                                    <strong>Booking confirmed!</strong>
                                    <p>Total due: {inr(bState.total || proposal.total)}</p>
                                    <p>Payment is the next step.</p>
                                  </div>
                                  <Link to="/rentals" className="success-link">
                                    View in My Rentals <ArrowRight size={14} aria-hidden="true" />
                                  </Link>
                                </div>
                                {bState.booking && (
                                  <div style={{ marginTop: "var(--s-2)" }}>
                                    <PayButton
                                      booking={bState.booking}
                                      onSuccess={(updated) => {
                                        setBookingStates((prev) => ({
                                          ...prev,
                                          [key]: {
                                            ...prev[key],
                                            booking: updated,
                                          },
                                        }));
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="proposal-action">
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleConfirmBooking(proposal)}
                                  disabled={bState?.loading}
                                >
                                  {bState?.loading ? "Confirming..." : "Confirm booking"}
                                </button>
                              </div>
                            )}

                            {bState?.error && (
                              <p
                                className="alert alert-error"
                                role="alert"
                                style={{ marginTop: "var(--s-2)" }}
                              >
                                {bState.error}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {sending && (
            <div className="ai-answer" ref={thinkingRef} style={{ opacity: 0.85 }}>
              <span className="ai-result-icon">
                <Sparkles size={18} aria-hidden="true" />
              </span>
              <div>
                <span>RentMate AI</span>
                <p>RentMate AI is thinking...</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div
            className="alert alert-error"
            role="alert"
            style={{
              marginBottom: "var(--s-3)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--s-2)",
            }}
          >
            <span>{error}</span>
            {canRetry && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={retryLastMessage}
                style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <RotateCcw size={14} aria-hidden="true" /> Retry
              </button>
            )}
          </div>
        )}

        <div className="assistant-box">
          <div className="assistant-input-wrap">
            <Sparkles size={19} aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="e.g. I need a study table under ₹700 a month"
              aria-label="Describe what you need"
              disabled={sending}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => sendMessage()}
              disabled={sending || !query.trim()}
            >
              {sending ? "Thinking..." : "Send"}
            </button>
          </div>

          <div className="suggestion-row">
            <span>Try:</span>
            <button
              type="button"
              className="chip"
              onClick={() => setQuery("I need a study table under 700 rupees a month")}
              disabled={sending}
            >
              <GraduationCap size={15} aria-hidden="true" /> Study table under ₹700
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => setQuery("I need a temporary room setup under ₹3000/month")}
              disabled={sending}
            >
              <Home size={15} aria-hidden="true" /> Temporary room setup
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => setQuery("I need a work from home setup under ₹2500/month")}
              disabled={sending}
            >
              <Briefcase size={15} aria-hidden="true" /> Work from home
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Assistant;
