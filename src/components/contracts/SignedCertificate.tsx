import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { statusLabel, docTypeLabel } from "@/lib/contractTemplate";

export const ELECTRONIC_SIGNATURE_CONSENT =
  "I agree to sign this document electronically. I understand that my typed name and electronic signature are legally binding, and that I may request a paper copy.";

export type CertificateSignature = {
  id: string;
  signer_role?: string | null;
  signer_name: string;
  signer_email: string;
  typed_name: string;
  signed_at: string;
  ip_address?: string | null;
  user_agent?: string | null;
  content_version_hash: string;
};

export type CertificateContract = {
  id: string;
  title: string;
  document_type: string;
  status: string;
  content: string;
  rendered_content: string | null;
  content_hash: string | null;
};

type AuditEntry = {
  id: string;
  action: string;
  actor_label: string | null;
  created_at: string;
};

function roleLabel(role?: string | null): string {
  if (role === "venue") return "Venue, Gilbertsville Farmhouse";
  return "Couple";
}

function authMethod(): string {
  return "Authenticated portal session, typed-name electronic signature";
}

/**
 * Shared, print-optimized Certificate of Signature.
 * Rendered hidden on screen and shown only via @media print.
 * Use the class "print-certificate" to drive print behavior (see index.css).
 */
export default function SignedCertificate({
  contract,
  renderedText,
  signatures,
}: {
  contract: CertificateContract;
  renderedText: string;
  signatures: CertificateSignature[];
}) {
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("contract_audit_log")
          .select("id, action, actor_label, created_at")
          .eq("contract_id", contract.id)
          .order("created_at", { ascending: true });
        if (cancelled) return;
        if (error) { setAuditEntries([]); return; }
        setAuditEntries((data ?? []) as AuditEntry[]);
      } catch {
        if (!cancelled) setAuditEntries([]);
      }
    })();
    return () => { cancelled = true; };
  }, [contract.id]);

  const ordered = [...signatures].sort(
    (a, b) => new Date(a.signed_at).getTime() - new Date(b.signed_at).getTime()
  );

  return (
    <div className="print-certificate" aria-hidden="true">
      {/* Page 1: Header + Frozen contract text */}
      <section className="cert-page">
        <header className="cert-header">
          <p className="cert-eyebrow">Gilbertsville Farmhouse</p>
          <h1 className="cert-title">{contract.title}</h1>
          <p className="cert-meta">
            {docTypeLabel(contract.document_type)} &nbsp;&middot;&nbsp; Status: {statusLabel(contract.status)}
          </p>
        </header>
        <div className="cert-body">{renderedText}</div>
      </section>

      {/* Page 2: Certificate of Signature */}
      <section className="cert-page cert-page-break">
        <h2 className="cert-section-title">Certificate of Signature</h2>
        {ordered.length === 0 ? (
          <p className="cert-paragraph">No signatures recorded.</p>
        ) : (
          <ol className="cert-sig-list">
            {ordered.map((s, i) => (
              <li key={s.id} className="cert-sig-item">
                <p className="cert-sig-index">Signature {i + 1} of {ordered.length}</p>
                <dl className="cert-sig-grid">
                  <dt>Role</dt><dd>{roleLabel(s.signer_role)}</dd>
                  <dt>Signer name</dt><dd>{s.signer_name}</dd>
                  <dt>Signer email</dt><dd>{s.signer_email}</dd>
                  <dt>Typed signature</dt>
                  <dd className="cert-typed">{s.typed_name}</dd>
                  <dt>Signed at</dt>
                  <dd>{new Date(s.signed_at).toLocaleString("en-US", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric",
                    hour: "numeric", minute: "2-digit", timeZoneName: "short",
                  })}</dd>
                  <dt>IP address</dt><dd>{s.ip_address || "Not recorded"}</dd>
                  <dt>Authentication method</dt><dd>{authMethod()}</dd>
                  <dt>Verification hash</dt>
                  <dd className="cert-hash">{s.content_version_hash}</dd>
                </dl>
              </li>
            ))}
          </ol>
        )}

        <div className="cert-fingerprint">
          <p className="cert-fingerprint-label">Document fingerprint (SHA-256)</p>
          <p className="cert-hash">{contract.content_hash || "Not recorded"}</p>
        </div>

        <div className="cert-consent">
          <p className="cert-consent-label">Electronic Signature Consent (acknowledged at signing)</p>
          <p className="cert-paragraph">{ELECTRONIC_SIGNATURE_CONSENT}</p>
        </div>

        {auditEntries.length > 0 && (
          <div className="cert-audit">
            <p className="cert-section-subtitle">Audit Trail</p>
            <ul className="cert-audit-list">
              {auditEntries.map((a) => (
                <li key={a.id}>
                  <span className="cert-audit-when">
                    {new Date(a.created_at).toLocaleString("en-US", {
                      year: "numeric", month: "short", day: "numeric",
                      hour: "numeric", minute: "2-digit",
                    })}
                  </span>
                  <span className="cert-audit-action">{a.action}</span>
                  <span className="cert-audit-actor">{a.actor_label || "system"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <footer className="cert-footer">
          <p>Gilbertsville Farmhouse &nbsp;&middot;&nbsp; gilbertsvillefarmhouse.com</p>
          <p>Generated {new Date().toLocaleString("en-US")}</p>
        </footer>
      </section>
    </div>
  );
}
