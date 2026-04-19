import { Skeleton } from "@/components/ui/skeleton";
import {
  Message,
  EventParticipant,
  formatTimestampHeader,
  shouldShowTimestampHeader,
  isGroupedWithPrev,
  hexToRgba,
  initialOf,
  parseMessageBody,
} from "@/lib/messageUtils";
import { MentionChip } from "./MentionChip";
export { MessageComposer } from "./MessageComposer";

interface MessageThreadProps {
  messages: Message[];
  participantsById: Record<string, EventParticipant>;
  currentEventUserId: string | null;
  loading: boolean;
}

export function MessageThread({ messages, participantsById, currentEventUserId, loading }: MessageThreadProps) {
  if (loading) {
    return (
      <div className="space-y-4 py-6">
        {[0, 1, 2].map(i => (
          <div key={i} className={`flex items-end gap-2 ${i % 2 ? "justify-end" : "justify-start"}`}>
            {i % 2 === 0 && <Skeleton className="w-9 h-9 rounded-full" />}
            <Skeleton className={`h-12 ${i % 2 ? "w-48" : "w-64"} rounded-2xl`} />
            {i % 2 === 1 && <Skeleton className="w-9 h-9 rounded-full" />}
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="font-display text-xl italic text-[#6B6B6B] text-center max-w-sm">
          The conversation begins here. Send the first note.
        </p>
      </div>
    );
  }

  return (
    <div className="py-2">
      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const showHeader = shouldShowTimestampHeader(prev, msg);
        const grouped = isGroupedWithPrev(prev, msg, showHeader);
        const isMe = msg.sender_event_user_id === currentEventUserId && currentEventUserId !== null;
        const sender = msg.sender_event_user_id ? participantsById[msg.sender_event_user_id] : null;
        const displayName = sender?.display_name ?? "Unknown sender";
        const color = sender?.color ?? "#6B6B6B";

        const senderChanged = prev && prev.sender_event_user_id !== msg.sender_event_user_id;
        const gapClass = grouped ? "mt-1" : senderChanged || i === 0 ? "mt-4" : "mt-2";

        return (
          <div key={msg.id}>
            {showHeader && (
              <div className="flex justify-center py-6">
                <span
                  className="font-body text-[11px] uppercase text-[#6B6B6B]"
                  style={{ letterSpacing: "2px" }}
                >
                  {formatTimestampHeader(msg.created_at)}
                </span>
              </div>
            )}

            <div className={`flex ${isMe ? "justify-end" : "justify-start"} ${gapClass}`}>
              <div className={`flex items-end gap-2 max-w-[78%] ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar */}
                <div className="w-9 h-9 shrink-0">
                  {!grouped ? (
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: color }}
                    >
                      <span className="font-display font-bold text-base text-[#FAF8F4] leading-none">
                        {initialOf(displayName)}
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Name + bubble */}
                <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} min-w-0`}>
                  {!grouped && (
                    <p
                      className="font-body text-[13px] uppercase mb-1 px-1"
                      style={{ letterSpacing: "0.08em", color: "#2C3E2D" }}
                    >
                      {displayName}
                    </p>
                  )}
                  <div
                    className="rounded-2xl px-4 py-2.5 break-words"
                    style={
                      isMe
                        ? { backgroundColor: hexToRgba(color, 0.2) }
                        : { backgroundColor: "#FFFFFF", border: "1px solid #E8E2D9" }
                    }
                  >
                    <p
                      className="font-body whitespace-pre-wrap"
                      style={{ fontSize: "15px", lineHeight: 1.5, color: "#1A1A1A" }}
                    >
                      {msg.body}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface MessageComposerProps {
  onSend: (text: string) => Promise<void>;
  placeholder?: string;
  className?: string;
}

export function MessageComposer({ onSend, placeholder = "Send a message…", className = "" }: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText("");
    try {
      await onSend(t);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className={className}>
      <div className="flex items-end gap-2.5">
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={placeholder}
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
          disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
      <p className="font-body text-[10px] text-muted-foreground mt-1.5 pl-1">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
