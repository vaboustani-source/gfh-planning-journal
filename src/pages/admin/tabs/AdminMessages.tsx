import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2 } from "lucide-react";

interface Message {
  id: string;
  body: string;
  sender_id: string | null;
  created_at: string | null;
  read_at: string | null;
}

function formatTime(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDateLabel(d: string | null) {
  if (!d) return "";
  const date = new Date(d);
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const msgDate = new Date(date); msgDate.setHours(0,0,0,0);
  if (msgDate.getTime() === today.getTime()) return "Today";
  if (msgDate.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function groupByDate(messages: Message[]) {
  const groups: { label: string; messages: Message[] }[] = [];
  let current = "";
  for (const msg of messages) {
    const label = formatDateLabel(msg.created_at);
    if (label !== current) { groups.push({ label, messages: [msg] }); current = label; }
    else groups[groups.length - 1].messages.push(msg);
  }
  return groups;
}

export default function AdminMessages({ eventId, onUnreadChange }: { eventId: string; onUnreadChange: (n: number) => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") =>
    bottomRef.current?.scrollIntoView({ behavior });

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("id, body, sender_id, created_at, read_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
  };

  const markRead = async () => {
    if (!user) return;
    await supabase.from("messages").update({ read_at: new Date().toISOString() })
      .eq("event_id", eventId).neq("sender_id", user.id).is("read_at", null);
    onUnreadChange(0);
  };

  useEffect(() => {
    if (!eventId) return;
    fetchMessages().then(() => {
      markRead();
      setTimeout(() => scrollToBottom("instant"), 100);
    });

    const channel = supabase
      .channel(`admin-messages-${eventId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `event_id=eq.${eventId}`,
      }, payload => {
        const newMsg = payload.new as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => scrollToBottom(), 50);
        markRead();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  useEffect(() => { if (!loading) scrollToBottom("instant"); }, [loading]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || !user || sending) return;
    setSending(true);
    setNewMessage("");
    await supabase.from("messages").insert({ event_id: eventId, sender_id: user.id, body: text });
    // Enqueue notification (fire and forget)
    supabase.functions.invoke("enqueue-message-notification", {
      body: { event_id: eventId, sender_id: user.id, message_body: text },
    }).catch(err => console.warn("Notification enqueue failed:", err));
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const groups = groupByDate(messages);

  return (
    <div className="flex flex-col animate-fade-up" style={{ height: "calc(100vh - 200px)", minHeight: "400px" }}>
      {/* Thread */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center mb-3">
              <Send size={16} className="text-sage" />
            </div>
            <p className="font-display text-xl font-light text-foreground mb-1">No messages yet</p>
            <p className="font-body text-sm text-muted-foreground">Start the conversation with the couple.</p>
          </div>
        )}
        {groups.map((group, gi) => (
          <div key={gi}>
            <div className="flex items-center gap-3 py-3">
              <div className="flex-1 h-px bg-border" />
              <span className="font-body text-[11px] text-muted-foreground">{group.label}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-1">
              {group.messages.map((msg, mi) => {
                const isMe = msg.sender_id === user?.id;
                const prevMsg = group.messages[mi - 1];
                const showTail = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                const isUnread = !msg.read_at && !isMe;

                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${showTail ? "mt-3" : "mt-0.5"}`}>
                    <div className="max-w-[75%] group">
                      {showTail && !isMe && (
                        <p className="font-body text-[10px] text-muted-foreground ml-1 mb-1">Couple</p>
                      )}
                      <div className={`px-3.5 py-2.5 rounded-2xl font-body text-sm leading-relaxed relative ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : isUnread
                          ? "bg-sage/15 border border-sage/30 text-foreground rounded-bl-sm"
                          : "bg-card border border-border text-foreground rounded-bl-sm shadow-soft"
                      }`}>
                        {msg.body}
                        {isUnread && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
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

      {/* Input */}
      <div className="border-t border-border bg-card/90 backdrop-blur-sm px-0 py-3">
        <div className="flex items-end gap-2.5">
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message the couple…"
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
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="font-body text-[10px] text-muted-foreground mt-1.5 pl-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
