import ContractsManager from "@/components/contracts/ContractsManager";

export default function ContractsTab({ eventId }: { eventId: string; onNavigateNext?: () => void }) {
  return (
    <div className="pb-24">
      <ContractsManager eventId={eventId} />
    </div>
  );
}
