import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MessageThread, MessageComposer } from "@/components/messages/MessageThread";
import { Message, EventParticipant } from "@/lib/messageUtils";

export default function AdminMessages({ eventId, onUnreadChange }: { eventId: string; onUnreadChange: (n: number) => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Record<string, EventParticipant>>({});
  const [currentEventUserId, setCurrentEventUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") =>
    bottomRef.current?.scrollIntoView({ behavior });

  // Load participants for this event (for avatar/name lookup) + ensure admin event_users row
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
      .select("id, body, sender_id, sender_event_user_id, created_at, read_at")
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

  useEffect(() => {
    if (!eventId) return;
    Promise.all([loadParticipants(), fetchMessages()]).then(() => {
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
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, user?.id]);

  useEffect(() => { if (!loading) scrollToBottom("instant"); }, [loading]);

  const handleSend = async (text: string, mentionIds: string[]) => {
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
    });
    supabase.functions.invoke("enqueue-message-notification", {
      body: { event_id: eventId, sender_id: user.id, message_body: text },
    }).catch(err => console.warn("Notification enqueue failed:", err));
  };

  const participantList = Object.values(participants);

  return (
    <div className="flex flex-col animate-fade-up" style={{ height: "calc(100vh - 200px)", minHeight: "400px" }}>
      <div className="flex-1 overflow-y-auto py-4">
        <MessageThread
          messages={messages}
          participantsById={participants}
          currentEventUserId={currentEventUserId}
          loading={loading}
        />
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-card/90 backdrop-blur-sm px-0 py-3">
        <MessageComposer
          onSend={handleSend}
          participants={participantList}
          currentEventUserId={currentEventUserId}
          placeholder="Message the couple…"
        />
      </div>
    </div>
  );
}
