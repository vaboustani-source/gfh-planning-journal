import GmailConnectCard from "@/components/admin/GmailConnectCard";

export default function SettingsIntegrations() {
  return (
    <div className="max-w-3xl">
      <h2 className="font-display text-3xl font-light text-foreground mb-6">
        Integrations
      </h2>
      <GmailConnectCard />
    </div>
  );
}
