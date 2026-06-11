import { sendEmail } from "../_shared/send-email.ts";
import { renderTemplate } from "../_shared/email-shell.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  contract_id: string;
  signer_email: string;
  signer_name: string;
  contract_title: string;
  signed_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Payload;
    if (!body.signer_email || !body.contract_title) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signedDate = new Date(body.signed_at).toLocaleString("en-US", {
      dateStyle: "long", timeStyle: "short",
    });

    const { subject, html } = await renderTemplate("contract_signed_receipt", {
      variables: {
        signer_name: body.signer_name,
        contract_title: body.contract_title,
        signed_date: signedDate,
      },
    });

    await sendEmail({
      to: body.signer_email,
      subject,
      html,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-contract-signed-receipt]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
