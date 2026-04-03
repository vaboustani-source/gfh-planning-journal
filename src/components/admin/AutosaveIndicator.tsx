import { Check, Loader2, AlertCircle } from "lucide-react";
import type { AutosaveState } from "@/hooks/useAutosaveStatus";

interface Props {
  status: AutosaveState;
  className?: string;
}

export default function AutosaveIndicator({ status, className = "" }: Props) {
  if (status === "idle") return null;

  return (
    <div className={`flex items-center gap-1.5 transition-opacity duration-300 ${className}`}>
      {status === "saving" && (
        <>
          <Loader2 size={12} className="animate-spin text-muted-foreground" />
          <span className="font-body text-xs text-muted-foreground">Saving…</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check size={12} className="text-sage" />
          <span className="font-body text-xs text-sage">Saved</span>
        </>
      )}
      {status === "unsaved" && (
        <>
          <AlertCircle size={12} className="text-muted-foreground" />
          <span className="font-body text-xs text-muted-foreground">Unsaved changes</span>
        </>
      )}
    </div>
  );
}
