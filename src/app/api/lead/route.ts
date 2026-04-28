import { NextRequest } from "next/server";

export const runtime = "nodejs";

interface LeadPayload {
  domain: string;
  email: string;
  maxPages?: number;
  auditUrl?: string;
}

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN?.trim();
const CLICKUP_LIST_ID = process.env.CLICKUP_LIST_ID?.trim();

export async function POST(req: NextRequest) {
  let body: LeadPayload;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const domain = (body.domain || "").trim().toLowerCase();
  const email = (body.email || "").trim().toLowerCase();

  if (!domain || !email || !email.includes("@")) {
    return Response.json({ ok: false, error: "domain and email required" }, { status: 400 });
  }

  // If credentials missing, log only and succeed (so UX doesn't break)
  if (!CLICKUP_TOKEN || !CLICKUP_LIST_ID) {
    console.warn("[lead] ClickUp credentials missing — captured locally only", { domain, email });
    return Response.json({ ok: true, queued: false });
  }

  const taskName = `Harmonic · ${domain}`;
  const description = [
    `**Tool:** Harmonic Centrality (internal)`,
    `**Domain:** ${domain}`,
    `**Email:** ${email}`,
    `**Crawl size:** up to ${body.maxPages ?? 100} pages`,
    body.auditUrl ? `**Audit URL:** ${body.auditUrl}` : "",
    `**Captured:** ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const resp = await fetch(`https://api.clickup.com/api/v2/list/${CLICKUP_LIST_ID}/task`, {
      method: "POST",
      headers: {
        Authorization: CLICKUP_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: taskName,
        description,
        // We try to set a custom field "type"; if it doesn't exist on this list, ClickUp ignores it.
        // The integration can be hardened later once the field IDs are known.
        tags: ["harmonic", "internal-tool", "lead"],
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error("[lead] ClickUp create-task failed", resp.status, text.slice(0, 300));
      return Response.json({ ok: true, queued: false, warning: "logged-only" });
    }
    const data = await resp.json();
    return Response.json({ ok: true, queued: true, taskId: data.id });
  } catch (err) {
    console.error("[lead] ClickUp create-task error", err);
    return Response.json({ ok: true, queued: false, warning: "logged-only" });
  }
}
