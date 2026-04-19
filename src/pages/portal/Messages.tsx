import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePortalData } from "@/hooks/usePortalData";
import { supabase } from "@/integrations/supabase/client";
import { MessageThread, MessageComposer } from "@/components/messages/MessageThread";
import { Message, EventParticipant } from "@/lib/messageUtils";

export default function Messages() {
  const { user } = useAuth();
  const { eventId } = usePortalData();
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Record<string, EventParticipant>>({});
  const [currentEventUserId, setCurrentEventUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  const loadParticipants = async () => {
    if (!eventId) return;
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
    if (!eventId) return;
    const { data } = await supabase
      .from("messages")
      .select("id, body, sender_id, sender_event_user_id, created_at, read_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Message[]);
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
    Promise.all([loadParticipants(), fetchMessages()]).then(() => {
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
          setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
          setTimeout(() => scrollToBottom(), 50);
          markAsRead();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, user?.id]);

  useEffect(() => {
    if (!loading) scrollToBottom("instant");
  }, [loading]);

  const handleSend = async (text: string, mentionIds: string[]) => {
    if (!eventId || !user) return;
    let eventUserId = currentEventUserId;
    if (!eventUserId) {
      console.error("[PortalMessages] No event_users row for current user on event", eventId);
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
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen" style={{ backgroundColor: "#FAF8F4" }}>
      {/* Header */}
      <div className="shrink-0 px-5 py-4 lg:px-8 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto">
          <p className="font-display text-2xl font-light text-foreground">Messages</p>
          <p className="font-body text-[12px] text-muted-foreground mt-0.5">
            Your event's group conversation.
          </p>
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-32 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <MessageThread
            messages={messages}
            participantsById={participants}
            currentEventUserId={currentEventUserId}
            loading={loading}
          />
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-60 z-30 border-t border-border bg-card/90 backdrop-blur-sm px-4 py-3 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <MessageComposer onSend={handleSend} placeholder="Send a message…" />
        </div>
      </div>
    </div>
  );
}
