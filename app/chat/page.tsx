import { Suspense } from "react";
import { ChatPlayground } from "@/components/chat-playground";

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="glass-card rounded-3xl p-5">Loading chat experience...</div>}>
      <ChatPlayground />
    </Suspense>
  );
}
