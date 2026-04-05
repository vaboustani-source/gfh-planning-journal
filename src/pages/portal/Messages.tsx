import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePortalData } from "@/hooks/usePortalData";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2 } from "lucide-react";
import { Message, formatSmartTimestamp, hasTimeGap } from "@/lib/messageUtils";

export default function Messages() {
  const { user } = useAuth();
  const { eventId } = usePortalData();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  const fetchMessages = async () => {
    if (!eventId) return;
    const { data } = await supabase
      .from("messages")
      .select("id, body, sender_id, created_at, read_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
  };

  const markAsRead = async () => {
    if (!eventId || !user) return;
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .neq("sender_id", user.id)
      .is("read_at", null);
  };

  useEffect(() => {
    if (!eventId) return;
    fetchMessages().then(() => {
      markAsRead();
      setTimeout(() => scrollToBottom("instant"), 100);
    });

    const channel = supabase
      .channel(`messages-${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => scrollToBottom(), 50);
          markAsRead();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  useEffect(() => {
    if (!loading) scrollToBottom("instant");
  }, [loading]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || !eventId || !user || sending) return;
    setSending(true);
    setNewMessage("");
    await supabase.from("messages").insert({
      event_id: eventId,
      sender_id: user.id,
      body: text,
    });
    supabase.functions.invoke("enqueue-message-notification", {
      body: { event_id: eventId, sender_id: user.id, message_body: text },
    }).catch(err => console.warn("Notification enqueue failed:", err));
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 lg:px-8 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-sage">
              <path d="M12 2C8 2 4 6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4-4-8-8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <div>
            <p className="font-body text-sm font-medium text-foreground">Brandon</p>
            <p className="font-body text-[11px] text-muted-foreground">Your coordinator · Gilbertsville Farmhouse</p>
          </div>
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {loading && (
            <div className="flex justify-center py-16">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-sage">
                  <path d="M12 2C8 2 4 6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4-4-8-8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </div>
              <p className="font-display text-xl font-light text-foreground mb-1">Start the conversation</p>
              <p className="font-body text-sm text-muted-foreground max-w-xs">
                Send Brandon a message with questions, ideas, or anything on your mind.
              </p>
            </div>
          )}

          {(() => {
            // Find the last message sent by me that has been read
            const lastReadId = (() => {
              for (let j = messages.length - 1; j >= 0; j--) {
                if (messages[j].sender_id === user?.id && messages[j].read_at) return messages[j].id;
              }
              return null;
            })();

            return messages.map((msg, i) => {
              const prevMsg = messages[i - 1];
              const isMe = msg.sender_id === user?.id;
              const sameSenderAsPrev = prevMsg && prevMsg.sender_id === msg.sender_id;
              const showTimeDivider = i === 0 || hasTimeGap(prevMsg, msg);
              const showSenderName = !isMe && (!sameSenderAsPrev || showTimeDivider);
              const showReadReceipt = isMe && msg.id === lastReadId;

              return (
                <div key={msg.id}>
                  {showTimeDivider && (
                    <div className="flex justify-center py-4">
                      <span className="font-body text-[11px] text-muted-foreground">
                        {formatSmartTimestamp(msg.created_at)}
                      </span>
                    </div>
                  )}

                  <div className={`flex ${isMe ? "justify-end" : "justify-start"} ${sameSenderAsPrev && !showTimeDivider ? "mt-0.5" : "mt-3"}`}>
                    <div className="max-w-[78%]">
                      {showSenderName && (
                        <p className="font-body text-[10px] text-muted-foreground ml-1 mb-1">Brandon</p>
                      )}

                      <div
                        onClick={() => setRevealedId(revealedId === msg.id ? null : msg.id)}
                        className={`px-3.5 py-2.5 rounded-2xl font-body text-sm leading-relaxed cursor-pointer select-none ${
                          isMe
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-card border border-border text-foreground rounded-bl-sm shadow-soft"
                        }`}
                      >
                        {msg.body}
                      </div>

                      {/* Tap-to-reveal timestamp */}
                      <div className={`overflow-hidden transition-all duration-200 ${revealedId === msg.id ? "max-h-6 opacity-100 mt-0.5" : "max-h-0 opacity-0"}`}>
                        <p className={`font-body text-[10px] text-muted-foreground ${isMe ? "text-right mr-1" : "ml-1"}`}>
                          {formatSmartTimestamp(msg.created_at)}
                        </p>
                      </div>

                      {/* Read receipt */}
                      {showReadReceipt && (
                        <p className="font-body text-[10px] text-muted-foreground/70 text-right mr-1 mt-0.5">Read</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-60 z-30 border-t border-border bg-card/90 backdrop-blur-sm px-4 py-3 lg:px-8">
        <div className="max-w-5xl mx-auto flex items-end gap-2.5">
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message…"
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors max-h-32 overflow-y-auto leading-relaxed"
            style={{ minHeight: "42px" }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 128) + "px";
            }}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-sage-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="max-w-5xl mx-auto font-body text-[10px] text-muted-foreground mt-1.5 pl-1">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
