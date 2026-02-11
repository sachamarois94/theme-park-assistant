"use client";

import { FormEvent, useEffect, useState } from "react";

type ParkOption = {
  id: string;
  name: string;
  resort: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function ChatPlayground() {
  const [parks, setParks] = useState<ParkOption[]>([]);
  const [parkId, setParkId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Ask me anything about wait times, next steps, or replanning your day."
    }
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/parks", { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        if (!mounted) {
          return;
        }
        setParks(json.parks ?? []);
        if (json.parks?.length > 0) {
          setParkId(json.parks[0].id);
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  async function submitMessage(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !parkId || pending) {
      return;
    }

    setPending(true);
    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    setInput("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ parkId, message: trimmed })
      });
      const json = await response.json();
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: json.reply ?? "I had trouble generating a response right now."
        }
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "Live data is temporarily unavailable. Try again in a moment."
        }
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
      <div className="glass-card rounded-3xl p-5 shadow-card">
        <p className="text-xs uppercase tracking-[0.22em] text-soft">Assistant Settings</p>
        <label className="mt-4 block text-xs uppercase tracking-[0.2em] text-soft">Park</label>
        <select
          value={parkId}
          onChange={(event) => setParkId(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white outline-none ring-accent-0/40 focus:ring"
        >
          {parks.map((park) => (
            <option key={park.id} value={park.id}>
              {park.name}
            </option>
          ))}
        </select>
        <div className="mt-5 space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-soft">Quick prompts</p>
          {[
            "What are wait times like right now?",
            "What should I do next?",
            "Help me replan this afternoon."
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="button-ghost w-full px-3 py-2 text-left text-sm"
              onClick={() => setInput(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-3xl p-4 shadow-glow md:p-5">
        <div className="max-h-[58vh] space-y-3 overflow-auto pr-1">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={message.role === "assistant"
                ? "rounded-2xl border border-cyan-200/20 bg-cyan-500/10 p-3"
                : "ml-auto max-w-[90%] rounded-2xl border border-white/15 bg-slate-900/55 p-3"}
            >
              <p className="text-xs uppercase tracking-[0.18em] text-soft">{message.role}</p>
              <p className="mt-1 text-sm leading-relaxed text-white">{message.content}</p>
            </div>
          ))}
          {pending ? <p className="text-sm text-soft">Assistant is thinking...</p> : null}
        </div>

        <form onSubmit={submitMessage} className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about waits, best next rides, or replanning..."
            className="w-full rounded-2xl border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white outline-none ring-accent-0/40 focus:ring"
          />
          <button type="submit" className="button-primary px-4 py-2 text-sm" disabled={pending}>
            Send
          </button>
        </form>
      </div>
    </section>
  );
}
