import { Check, Loader2, Save, ArrowRight, AlertCircle } from "lucide-react";
import type { AutosaveState } from "@/hooks/useAutosaveStatus";

interface Props {
  status: AutosaveState;
  onSave: () => void;
  onSaveAndContinue: () => void;
}

export default function AdminStickyFooter({ status, onSave, onSaveAndContinue }: Props) {
  const isSaving = status === "saving";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-sm border-t border-sage/20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left — status */}
        <div className="flex items-center gap-1.5 min-w-0">
          {status === "saving" && (
            <>
              <Loader2 size={13} className="animate-spin text-muted-foreground" />
              <span className="font-body text-xs text-muted-foreground">Saving…</span>
            </>
          )}
          {status === "saved" && (
            <>
              <Check size={13} className="text-sage" />
              <span className="font-body text-xs text-sage">Saved</span>
            </>
          )}
          {status === "unsaved" && (
            <>
              <AlertCircle size={13} className="text-amber-500" />
              <span className="font-body text-xs text-amber-600">Unsaved changes</span>
            </>
          )}
        </div>

        {/* Right — buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-sage px-5 py-2.5 font-body text-sm font-medium text-white hover:bg-sage/90 transition-colors disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span className="hidden sm:inline">Save Changes</span>
            <span className="sm:hidden">Save</span>
          </button>
          <button
            onClick={onSaveAndContinue}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 font-body text-sm font-medium text-white hover:bg-forest/90 transition-colors disabled:opacity-60"
          >
            <span className="hidden sm:inline">Save & Continue</span>
            <span className="sm:hidden">Next</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
