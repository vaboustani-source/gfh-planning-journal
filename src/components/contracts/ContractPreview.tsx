import { useState } from "react";
import { X, Smartphone, Monitor, Download, Send, AlertTriangle, ShieldCheck } from "lucide-react";
import ContractDocument from "@/components/contracts/ContractDocument";
import { docTypeLabel } from "@/lib/contractTemplate";
import { downloadContractPdf } from "@/lib/contractPdf";

/**
 * Staff preview of a contract before it's sent: the couple's portal view in a phone or desktop
 * frame, the PDF they'll be able to download, and any blanks still empty.
 */
export default function ContractPreview({ title, documentType, text, missing, onClose, onSend }: {
  title: string;
  documentType: string;
  text: string;
  missing: string[];
  onClose: () => void;
  onSend?: () => void;
}) {
  const [device, setDevice] = useState<"phone" | "desktop">("phone");

  const page = (
    <div className={device === "phone" ? "px-4 py-6" : "px-8 py-10 md:px-12"}>
      <p className="font-body text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{docTypeLabel(documentType)}</p>
      <h1 className={`font-display text-foreground mt-2 ${device === "phone" ? "text-2xl" : "text-3xl"}`}>{title}</h1>
      <span className="inline-block mt-3 font-body text-[11px] rounded-full px-2 py-0.5 border bg-amber-50 text-amber-800 border-amber-200">
        Awaiting your signature
      </span>
      <div className="border-t border-border mt-6 pt-6">
        <ContractDocument text={text} />
      </div>
      <div className="mt-10 pt-6 border-t border-border space-y-3 opacity-60 pointer-events-none select-none">
        <p className="font-display text-lg text-foreground flex items-center gap-2"><ShieldCheck size={16} className="text-sage" /> Sign this agreement</p>
        <div className="h-10 border-b-2 border-border" />
        <p className="font-body text-xs text-muted-foreground">Each partner signs here from their own login.</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-foreground/60 backdrop-blur-sm flex flex-col">
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-2 flex-wrap">
        <p className="font-display text-lg text-foreground mr-auto">Preview</p>
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button onClick={() => setDevice("phone")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-body text-xs ${device === "phone" ? "bg-primary text-primary-foreground" : "bg-background"}`}>
            <Smartphone size={13} /> Phone
          </button>
          <button onClick={() => setDevice("desktop")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-body text-xs ${device === "desktop" ? "bg-primary text-primary-foreground" : "bg-background"}`}>
            <Monitor size={13} /> Desktop
          </button>
        </div>
        <button
          onClick={() => downloadContractPdf({ contract: { title, document_type: documentType, status: "draft" }, text, preview: true })}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 font-body text-xs hover:border-primary/40">
          <Download size={13} /> Preview PDF
        </button>
        {onSend && (
          <button onClick={onSend} disabled={missing.length > 0}
            title={missing.length ? "Fill in every blank first" : undefined}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 font-body text-xs hover:opacity-90 disabled:opacity-40">
            <Send size={13} /> Send to couple
          </button>
        )}
        <button onClick={onClose} aria-label="Close preview" className="p-1.5 text-muted-foreground hover:text-foreground"><X size={18} /></button>
      </div>

      {missing.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 font-body text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>Still blank (highlighted below): {missing.join(", ")}. Close the preview to fill them in.</span>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center">
        {device === "phone" ? (
          <div className="w-[390px] max-w-full h-[780px] max-h-full rounded-[2.5rem] border-[10px] border-neutral-800 bg-background shadow-2xl overflow-hidden flex flex-col shrink-0">
            <div className="h-6 bg-neutral-800 flex justify-center"><div className="w-24 h-4 bg-neutral-900 rounded-b-xl" /></div>
            <div className="flex-1 overflow-y-auto bg-white">{page}</div>
          </div>
        ) : (
          <div className="w-full max-w-3xl h-fit bg-white rounded-xl border border-border shadow-2xl">{page}</div>
        )}
      </div>
    </div>
  );
}
