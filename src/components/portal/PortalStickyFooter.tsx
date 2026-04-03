import { ArrowRight, Loader2 } from "lucide-react";

interface Props {
  onContinue: () => void;
  saving?: boolean;
  /** If true, shows "Next" only (no save) */
  nextOnly?: boolean;
}

export default function PortalStickyFooter({ onContinue, saving = false, nextOnly = false }: Props) {
  return (
    <div className="fixed bottom-14 lg:bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-sm border-t border-sage/20">
      <div className="max-w-lg mx-auto px-5 py-3 flex justify-center">
        <button
          onClick={onContinue}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-sage px-8 py-3 font-body text-sm font-medium text-white hover:bg-sage/90 transition-colors disabled:opacity-60 w-full sm:w-auto justify-center"
        >
          {saving ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Saving…
            </>
          ) : nextOnly ? (
            <>
              Next
              <ArrowRight size={15} />
            </>
          ) : (
            <>
              Looks good, keep going
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
