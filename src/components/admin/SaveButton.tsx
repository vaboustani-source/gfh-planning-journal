import { Check, Save, Loader2 } from "lucide-react";
import type { AutosaveState } from "@/hooks/useAutosaveStatus";

interface Props {
  status: AutosaveState;
  onClick: () => void;
  label?: string;
}

export default function SaveButton({ status, onClick, label = "Save Changes" }: Props) {
  const isSaving = status === "saving";
  const isSaved = status === "saved";

  return (
    <button
      onClick={onClick}
      disabled={isSaving}
      className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-sage px-8 py-3 font-body text-sm font-medium text-white hover:bg-sage/90 transition-colors disabled:opacity-60"
    >
      {isSaving ? (
        <><Loader2 size={15} className="animate-spin" /> Saving…</>
      ) : isSaved ? (
        <><Check size={15} /> Saved!</>
      ) : (
        <><Save size={15} /> {label}</>
      )}
    </button>
  );
}
