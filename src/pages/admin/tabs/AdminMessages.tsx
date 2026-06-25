import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MessageThread, MessageComposer, ReplyTarget } from "@/components/messages/MessageThread";
import { MessageSearchBar } from "@/components/messages/MessageSearchBar";
import { Message, EventParticipant, bodyToPlainText, truncate } from "@/lib/messageUtils";

// Map portal section keys -> admin tab ids
const SECTION_TO_ADMIN_TAB: Record<string, string> = {
  vendors: "vendors",
  lodging: "lodging",
  ceremony: "ceremony",
  menus: "menus-bar",
  timeline: "timeline",
  financials: "financials",
  decor: "decor",
  planning: "checklist",
};

export default function AdminMessages({ eventId, onUnreadChange }: { eventId: string; onUnreadChange: (n: number) => void }) {
  const { user } = useAuth();
  const [, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Record<string, EventParticipant>>({});
  const [currentEventUserId, setCurrentEventUserId] = useState<string | null>(null);
  const [readState, setReadState] = useState<Record<string, string>>({});

  const handleSectionClick = (key: string) => {
    const tab = SECTION_TO_ADMIN_TAB[key];
    if (tab) setSearchParams({ tab }, { replace: false });
  };
  const [loading, setLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") =>
    bottomRef.current?.scrollIntoView({ behavior });

  const loadParticipants = async () => {
    const { data } = await supabase
      .from("event_users")
      .select("id, user_id, display_name, color, role_in_event")
      .eq("event_id", eventId);
    const map: Record<string, EventParticipant> = {};
    (data ?? []).forEach(p => { map[p.id] = p as EventParticipant; });
    setParticipants(map);

    if (user) {
      const mine = (data ?? []).find(p => p.user_id === user.id);
      setCurrentEventUserId(mine?.id ?? null);
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("id, body, sender_id, sender_event_user_id, created_at, read_at, reply_to_message_id")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Message[]);
    setLoading(false);
  };

  const markRead = async () => {
    if (!user) return;
    await supabase.from("messages").update({ read_at: new Date().toISOString() })
      .eq("event_id", eventId).neq("sender_id", user.id).is("read_at", null);
    onUnreadChange(0);
  };

  const upsertReadState = async (euId: string | null) => {
    if (!eventId || !euId) return;
    const now = new Date().toISOString();
    await supabase
      .from("message_read_state")
      .upsert(
        { event_user_id: euId, event_id: eventId, last_read_at: now, updated_at: now },
        { onConflict: "event_user_id" }
      );
  };

  const loadReadState = async () => {
    if (!eventId) return;
    const { data } = await supabase
      .from("message_read_state")
      .select("event_user_id, last_read_at")
      .eq("event_id", eventId);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((r: any) => { map[r.event_user_id] = r.last_read_at; });
      setReadState(map);
    }
  };

  useEffect(() => {
    if (!eventId) return;
    Promise.all([loadParticipants(), fetchMessages(), loadReadState()]).then(() => {
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
        setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        setTimeout(() => scrollToBottom(), 50);
        markRead();
        upsertReadState(currentEventUserId);
      })
      .subscribe();

    const readChannel = supabase
      .channel(`admin-message-read-state-${eventId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "message_read_state",
        filter: `event_id=eq.${eventId}`,
      }, payload => {
        const row = (payload.new ?? payload.old) as any;
        if (!row?.event_user_id) return;
        setReadState(prev => ({ ...prev, [row.event_user_id]: row.last_read_at }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(readChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, user?.id, currentEventUserId]);

  useEffect(() => {
    upsertReadState(currentEventUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEventUserId, eventId]);

  useEffect(() => { if (!loading) scrollToBottom("instant"); }, [loading]);

  const handleSend = async (text: string, mentionIds: string[], replyToMessageId: string | null) => {
    if (!user) return;
    let eventUserId = currentEventUserId;
    if (!eventUserId) {
      console.error("[AdminMessages] No event_users row for current admin on event", eventId);
    }
    await supabase.from("messages").insert({
      event_id: eventId,
      sender_id: user.id,
      sender_event_user_id: eventUserId,
      body: text,
      mentions: mentionIds,
      reply_to_message_id: replyToMessageId,
    });
    supabase.functions.invoke("enqueue-message-notification", {
      body: { event_id: eventId, sender_id: user.id, message_body: text },
    }).catch(err => console.warn("Notification enqueue failed:", err));
  };

  const handleReply = (msg: Message) => {
    const sender = msg.sender_event_user_id ? participants[msg.sender_event_user_id] : null;
    setReplyTarget({
      messageId: msg.id,
      senderName: sender?.display_name ?? "Unknown",
      senderColor: sender?.color ?? "#6B6B6B",
      preview: truncate(bodyToPlainText(msg.body, participants), 80),
    });
  };

  const participantList = Object.values(participants);

  return (
    <div className="flex flex-col animate-fade-up" style={{ height: "calc(100vh - 200px)", minHeight: "400px" }}>
      <div className="shrink-0 pb-3">
        <MessageSearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <MessageThread
          messages={messages}
          participantsById={participants}
          currentEventUserId={currentEventUserId}
          loading={loading}
          onReply={handleReply}
          onSectionClick={handleSectionClick}
          searchQuery={searchQuery}
        />
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-card/90 backdrop-blur-sm px-0 py-3">
        <MessageComposer
          onSend={handleSend}
          participants={participantList}
          currentEventUserId={currentEventUserId}
          placeholder="Message the couple…"
          replyTarget={replyTarget}
          onCancelReply={() => setReplyTarget(null)}
        />
      </div>
    </div>
  );
}
