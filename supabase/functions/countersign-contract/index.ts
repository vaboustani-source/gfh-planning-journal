import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsRes, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const userId = claimsRes.claims.sub as string;
    const userEmail = (claimsRes.claims.email as string | undefined) ?? "";
    const provider =
      ((claimsRes.claims as Record<string, unknown>).app_metadata as
        | { provider?: string }
        | undefined)?.provider ?? "email";

    const body = (await req.json().catch(() => null)) as
      | { contract_id?: string; typed_name?: string; agreed_to_terms?: boolean }
      | null;
    if (!body || typeof body.contract_id !== "string" || typeof body.typed_name !== "string") {
      return json({ error: "Invalid request body" }, 400);
    }
    if (body.agreed_to_terms !== true) return json({ error: "You must agree to the terms" }, 400);
    const typedName = body.typed_name.trim();
    if (typedName.length < 3) return json({ error: "Typed name is too short" }, 400);

    // Caller must be admin
    const { data: caller } = await admin
      .from("users")
      .select("id, role, first_name, last_name, email")
      .eq("id", userId)
      .maybeSingle();
    if (!caller || caller.role !== "admin") {
      return json({ error: "Only admins can countersign" }, 403);
    }

    // Load contract
    const { data: contract, error: cErr } = await admin
      .from("contracts")
      .select("id, status, requires_countersignature, content, rendered_content")
      .eq("id", body.contract_id)
      .maybeSingle();
    if (cErr || !contract) return json({ error: "Contract not found" }, 404);

    if (contract.status !== "fully_signed" || !contract.requires_countersignature) {
      return json({ error: "Contract is not ready for countersignature" }, 409);
    }

    const { data: existingVenue } = await admin
      .from("contract_signatures")
      .select("id")
      .eq("contract_id", contract.id)
      .eq("signer_role", "venue")
      .maybeSingle();
    if (existingVenue) return json({ error: "This contract has already been countersigned" }, 409);

    // Server-captured client info
    const xff = req.headers.get("x-forwarded-for") ?? "";
    const ip = (xff.split(",")[0] || req.headers.get("cf-connecting-ip") || "").trim() || null;
    const userAgent = req.headers.get("user-agent") ?? null;

    const accountName = [caller.first_name, caller.last_name].filter(Boolean).join(" ").trim();
    const signerName = accountName || typedName;

    const frozen = contract.rendered_content ?? contract.content ?? "";
    const contentVersionHash = await sha256Hex(frozen);
    const authMethod = provider === "google" ? "google" : "password";

    const { error: insErr } = await admin.from("contract_signatures").insert({
      contract_id: contract.id,
      signer_role: "venue",
      signer_name: signerName,
      signer_email: caller.email ?? userEmail,
      signer_user_id: userId,
      typed_name: typedName,
      agreed_to_terms: true,
      ip_address: ip,
      user_agent: userAgent,
      content_version_hash: contentVersionHash,
      auth_method: authMethod,
      signed_at: new Date().toISOString(),
    });
    if (insErr) return json({ error: insErr.message }, 500);

    const { error: updErr } = await admin
      .from("contracts")
      .update({ status: "executed" })
      .eq("id", contract.id);
    if (updErr) return json({ error: updErr.message }, 500);

    await admin.from("contract_audit_log").insert({
      contract_id: contract.id,
      action: "countersigned",
      actor_user_id: userId,
      actor_label: signerName || caller.email,
      ip_address: ip,
      user_agent: userAgent,
      metadata: { auth_method: authMethod, new_status: "executed" },
    });

    return json({ ok: true, status: "executed" });
  } catch (e) {
    console.error("[countersign-contract]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
