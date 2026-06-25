import GmailConnectCard from "@/components/admin/GmailConnectCard";
import EmailSignatureCard from "@/components/admin/EmailSignatureCard";

export default function SettingsIntegrations() {
  return (
    <div className="max-w-3xl">
      <h2 className="font-display text-3xl font-light text-foreground mb-6">
        Integrations
      </h2>
      <GmailConnectCard />
      <EmailSignatureCard />
    </div>
  );
}
