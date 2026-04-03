import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePortalData } from "@/hooks/usePortalData";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2 } from "lucide-react";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";

interface Message {
  id: string;
  body: string;
  sender_id: string | null;
  created_at: string | null;
  read_at: string | null;
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDateLabel(dateStr: string | null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const msgDate = new Date(date); msgDate.setHours(0, 0, 0, 0);

  if (msgDate.getTime() === today.getTime()) return "Today";
  if (msgDate.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function groupByDate(messages: Message[]) {
  const groups: { label: string; messages: Message[] }[] = [];
  let currentLabel = "";
  for (const msg of messages) {
    const label = formatDateLabel(msg.created_at);
    if (label !== currentLabel) {
      groups.push({ label, messages: [msg] });
      currentLabel = label;
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }
  return groups;
}

export default function Messages() {
  const { user } = useAuth();
  const { eventId } = usePortalData();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
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
    // Mark messages not sent by this user as read
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

    // Real-time subscription
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

    // Enqueue notification (fire and forget)
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

  const groups = groupByDate(messages);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen">

      {/* Header */}
      <div className="shrink-0 px-5 py-4 lg:px-8 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
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
      <div className="flex-1 overflow-y-auto px-4 py-5 lg:px-8">
        <div className="max-w-2xl mx-auto space-y-1">

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

          {groups.map((group, gi) => (
            <div key={gi}>
              {/* Date separator */}
              <div className="flex items-center gap-3 py-4">
                <div className="flex-1 h-px bg-border" />
                <span className="font-body text-[11px] text-muted-foreground shrink-0">{group.label}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Messages in this group */}
              <div className="space-y-1">
                {group.messages.map((msg, mi) => {
                  const isMe = msg.sender_id === user?.id;
                  const prevMsg = group.messages[mi - 1];
                  const showTail = !prevMsg || prevMsg.sender_id !== msg.sender_id;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"} ${showTail ? "mt-3" : "mt-0.5"}`}
                    >
                      <div className={`max-w-[78%] group`}>
                        {/* Sender label */}
                        {showTail && !isMe && (
                          <p className="font-body text-[10px] text-muted-foreground ml-1 mb-1">Brandon</p>
                        )}

                        <div
                          className={`px-3.5 py-2.5 rounded-2xl font-body text-sm leading-relaxed ${
                            isMe
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-card border border-border text-foreground rounded-bl-sm shadow-soft"
                          }`}
                        >
                          {msg.body}
                        </div>

                        {/* Timestamp on hover */}
                        <p className={`font-body text-[10px] text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? "text-right mr-1" : "ml-1"}`}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border bg-card/90 backdrop-blur-sm px-4 py-3 lg:px-8">
        <div className="max-w-2xl mx-auto flex items-end gap-2.5">
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
        <p className="max-w-2xl mx-auto font-body text-[10px] text-muted-foreground mt-1.5 pl-1">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>

      <PortalStickyFooter onContinue={() => navigate("/portal/notes")} nextOnly />
    </div>
  );
}
