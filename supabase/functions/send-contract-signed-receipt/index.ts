import { sendEmail } from "../_shared/send-email.ts";

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

    const dateStr = new Date(body.signed_at).toLocaleString("en-US", {
      dateStyle: "long", timeStyle: "short",
    });

    const html = `
      <div style="font-family: Georgia, 'Cormorant Garamond', serif; max-width: 560px; margin: 0 auto; padding: 32px; background:#FAF8F4; color:#1A1A1A;">
        <h1 style="font-size: 26px; font-weight: 400; margin: 0 0 8px; color:#2C3E2D;">Signature Confirmed</h1>
        <p style="font-family: Helvetica, Arial, sans-serif; font-size:14px; color:#6B6B6B; margin: 0 0 24px;">
          Gilbertsville Farmhouse
        </p>
        <div style="background:#FFFFFF; border:1px solid #E8E2D9; border-radius: 10px; padding: 24px;">
          <p style="font-family: Helvetica, Arial, sans-serif; font-size:14px; line-height:1.6; margin:0 0 12px;">
            Dear ${body.signer_name},
          </p>
          <p style="font-family: Helvetica, Arial, sans-serif; font-size:14px; line-height:1.6; margin:0 0 16px;">
            This is your receipt for the agreement you just signed:
          </p>
          <p style="font-size: 20px; margin: 12px 0 4px; color:#2C3E2D;">${body.contract_title}</p>
          <p style="font-family: Helvetica, Arial, sans-serif; font-size:13px; color:#6B6B6B; margin:0 0 20px;">
            Signed on ${dateStr}
          </p>
          <p style="font-family: Helvetica, Arial, sans-serif; font-size:13px; line-height:1.6; color:#6B6B6B; margin:0;">
            A copy is saved in your portal under <strong>Agreements</strong> for your records.
            If anything looks incorrect, please reply to this email right away.
          </p>
        </div>
        <p style="font-family: Helvetica, Arial, sans-serif; font-size:12px; color:#6B6B6B; margin: 24px 0 0; text-align:center;">
          Gilbertsville Farmhouse · A private estate in upstate New York
        </p>
      </div>
    `;

    await sendEmail({
      to: body.signer_email,
      subject: `Signature receipt: ${body.contract_title}`,
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
