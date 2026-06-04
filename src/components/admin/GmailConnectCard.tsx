import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Mail, CheckCircle2, Loader2, Link2, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function GmailConnectCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [emailAddress, setEmailAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("gmail_connections")
      .select("email_address")
      .eq("user_id", user.id)
      .maybeSingle();
    setEmailAddress(data?.email_address ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  // Handle redirect-back from OAuth
  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("gmail");
    if (!status) return;
    if (status === "connected") {
      toast.success(`Gmail connected as ${url.searchParams.get("email")}`);
      load();
    } else if (status === "error") {
      toast.error(`Gmail connection failed: ${url.searchParams.get("reason") ?? "unknown"}`);
    }
    url.searchParams.delete("gmail");
    url.searchParams.delete("email");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const connect = async () => {
    setConnecting(true);
    const oauthWindow = window.open("about:blank", "_blank");
    if (oauthWindow) oauthWindow.opener = null;

    try {
      const { data, error } = await supabase.functions.invoke("gmail-oauth-start", {
        body: {
          return_to: `${window.location.pathname}${window.location.search}`,
          app_origin: window.location.origin,
        },
      });
      if (error || !data?.url) throw new Error(error?.message ?? "Could not start OAuth");
      if (oauthWindow) {
        oauthWindow.location.href = data.url;
      } else {
        window.location.href = data.url;
      }
    } catch (e: any) {
      if (oauthWindow && !oauthWindow.closed) oauthWindow.close();
      toast.error(e.message ?? "Connection failed");
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!user) return;
    if (!confirm("Disconnect Gmail? You'll need to reconnect to file new emails.")) return;
    await supabase.from("gmail_connections").delete().eq("user_id", user.id);
    setEmailAddress(null);
    toast.success("Gmail disconnected");
  };

  return (
    <section>
      <div className="mb-6">
        <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Integrations</p>
        <h2 className="font-display text-3xl font-light text-foreground">Gmail</h2>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Connect Brandon's inbox so emails can be filed into events.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center shrink-0">
          <Mail size={16} className="text-sage" />
        </div>
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 size={14} className="animate-spin" /> <span className="font-body text-sm">Checking connection…</span></div>
          ) : emailAddress ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <CheckCircle2 size={14} className="text-sage" />
                <span className="font-body text-sm text-foreground">Connected as <span className="font-medium">{emailAddress}</span></span>
              </div>
              <p className="font-body text-xs text-muted-foreground mt-1">
                New replies in filed threads auto-sync every 15 minutes.
              </p>
            </>
          ) : (
            <>
              <p className="font-body text-sm text-foreground">Not connected yet.</p>
              <p className="font-body text-xs text-muted-foreground mt-1">
                Read-only access — emails are pulled into the app, never sent.
              </p>
            </>
          )}
        </div>
        <div className="shrink-0">
          {emailAddress ? (
            <button
              onClick={disconnect}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/40 font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut size={12} /> Disconnect
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {connecting ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              Connect Gmail
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
