import { useMemo, useRef, useState } from "react";
import { Reply } from "lucide-react";
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
  bodyToPlainText,
  truncate,
} from "@/lib/messageUtils";
import { MentionChip } from "./MentionChip";
import { SectionChip } from "./SectionChip";
import { highlightText } from "./MessageSearchBar";
export { MessageComposer } from "./MessageComposer";
export type { ReplyTarget } from "./MessageComposer";

interface MessageThreadProps {
  messages: Message[];
  participantsById: Record<string, EventParticipant>;
  currentEventUserId: string | null;
  loading: boolean;
  onReply?: (msg: Message) => void;
  onSectionClick?: (sectionKey: string) => void;
  searchQuery?: string;
}

export function MessageThread({
  messages,
  participantsById,
  currentEventUserId,
  loading,
  onReply,
  onSectionClick,
  searchQuery = "",
}: MessageThreadProps) {
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const visibleMessages = useMemo(() => {
    if (!trimmedQuery) return messages;
    return messages.filter(m =>
      bodyToPlainText(m.body, participantsById).toLowerCase().includes(trimmedQuery)
    );
  }, [messages, participantsById, trimmedQuery]);
  const [longPressedId, setLongPressedId] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToMessage = (id: string) => {
    const el = messageRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("message-highlight-pulse");
    // Force reflow so animation re-triggers
    void el.offsetWidth;
    el.classList.add("message-highlight-pulse");
    window.setTimeout(() => el.classList.remove("message-highlight-pulse"), 1100);
  };

  const startLongPress = (id: string) => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => setLongPressedId(id), 450);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

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

  const messageById: Record<string, Message> = {};
  messages.forEach(m => { messageById[m.id] = m; });

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

        const replyTo = msg.reply_to_message_id ? messageById[msg.reply_to_message_id] : null;
        const replySender = replyTo?.sender_event_user_id
          ? participantsById[replyTo.sender_event_user_id]
          : null;
        const replyColor = replySender?.color ?? "#6B6B6B";
        const replyName = replySender?.display_name ?? "Unknown";
        const replyPreview = replyTo
          ? truncate(bodyToPlainText(replyTo.body, participantsById), 80)
          : null;
        const replyDeleted = !!msg.reply_to_message_id && !replyTo;

        const showActions = !!onReply;
        const isLongPressed = longPressedId === msg.id;

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

                {/* Name + (quote) + bubble + hover reply */}
                <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} min-w-0 group relative`}>
                  {!grouped && (
                    <p
                      className="font-body text-[13px] uppercase mb-1 px-1"
                      style={{ letterSpacing: "0.08em", color: "#2C3E2D" }}
                    >
                      {displayName}
                    </p>
                  )}

                  {/* Quoted preview (above bubble, max 70%, inset on avatar side) */}
                  {(replyTo || replyDeleted) && (
                    <button
                      type="button"
                      onClick={() => replyTo && scrollToMessage(replyTo.id)}
                      disabled={replyDeleted}
                      className={`max-w-[70%] text-left mb-[2px] ${
                        isMe ? "mr-6" : "ml-6"
                      } ${replyDeleted ? "cursor-default" : "cursor-pointer hover:opacity-90"}`}
                      style={{
                        backgroundColor: "#F5F2EC",
                        borderLeft: `2px solid ${replyDeleted ? "#6B6B6B" : replyColor}`,
                        padding: "8px",
                        borderRadius: "8px 8px 8px 2px",
                      }}
                    >
                      {replyDeleted ? (
                        <p
                          className="font-body italic"
                          style={{ fontSize: "13px", color: "#6B6B6B" }}
                        >
                          Message removed
                        </p>
                      ) : (
                        <>
                          <p
                            className="font-body uppercase"
                            style={{ fontSize: "11px", letterSpacing: "0.08em", color: "#2C3E2D" }}
                          >
                            {replyName}
                          </p>
                          <p
                            className="font-body truncate"
                            style={{ fontSize: "13px", color: "#6B6B6B" }}
                          >
                            {replyPreview}
                          </p>
                        </>
                      )}
                    </button>
                  )}

                  <div
                    ref={el => { messageRefs.current[msg.id] = el; }}
                    className="relative flex items-center gap-2"
                  >
                    {/* Reply button (desktop, opposite side) */}
                    {showActions && !isMe && (
                      <></>
                    )}
                    <div
                      className="rounded-2xl px-4 py-2.5 break-words"
                      style={
                        isMe
                          ? { backgroundColor: hexToRgba(color, 0.2) }
                          : { backgroundColor: "#FFFFFF", border: "1px solid #E8E2D9" }
                      }
                      onTouchStart={() => startLongPress(msg.id)}
                      onTouchEnd={cancelLongPress}
                      onTouchMove={cancelLongPress}
                      onTouchCancel={cancelLongPress}
                    >
                      <p
                        className="font-body whitespace-pre-wrap"
                        style={{ fontSize: "15px", lineHeight: 1.5, color: "#1A1A1A" }}
                      >
                        {parseMessageBody(msg.body).map((part, idx) =>
                          part.type === "text" ? (
                            <span key={idx}>{part.value}</span>
                          ) : (
                            <MentionChip
                              key={idx}
                              participant={participantsById[part.eventUserId] ?? null}
                            />
                          ),
                        )}
                      </p>
                    </div>
                    {showActions && (
                      <button
                        type="button"
                        onClick={() => { onReply?.(msg); setLongPressedId(null); }}
                        aria-label="Reply to message"
                        className={`hidden md:flex items-center justify-center w-7 h-7 rounded-full bg-card border border-border shadow-sm transition-opacity ${
                          isLongPressed ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        } ${isMe ? "order-first" : "order-last"}`}
                        style={{ color: "#6B6B6B" }}
                      >
                        <Reply size={14} />
                      </button>
                    )}
                  </div>

                  {/* Mobile long-press menu */}
                  {showActions && isLongPressed && (
                    <div
                      className="md:hidden mt-1 rounded-lg border bg-card shadow-md overflow-hidden"
                      style={{ borderColor: "#E8E2D9" }}
                    >
                      <button
                        type="button"
                        onClick={() => { onReply?.(msg); setLongPressedId(null); }}
                        className="flex items-center gap-2 px-3 py-2 font-body text-sm text-foreground hover:bg-muted/40"
                      >
                        <Reply size={14} /> Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => setLongPressedId(null)}
                        className="block w-full text-left px-3 py-2 font-body text-sm text-muted-foreground hover:bg-muted/40 border-t"
                        style={{ borderColor: "#E8E2D9" }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
