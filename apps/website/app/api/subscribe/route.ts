import { z } from "zod";

/**
 * Newsletter signup → Buttondown. Three states by design:
 *  - NEWSLETTER_API_KEY missing → 503, form renders disabled (build still passes)
 *  - key present → validate (zod) + honeypot + naive per-IP rate limit → provider
 *  - provider unavailable → friendly 502, never a crash
 */

const BodySchema = z.object({
  email: z.email(),
  company: z.string().optional(), // honeypot — humans leave it empty
});

// Naive in-memory rate limit (per instance): 5 requests / minute / IP.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear(); // crude memory cap
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.NEWSLETTER_API_KEY;
  if (!apiKey) {
    return Response.json({ message: "Newsletter signup is not enabled yet." }, { status: 503 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return Response.json(
      { message: "Too many requests — please try again in a minute." },
      { status: 429 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ message: "Invalid request body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ message: "Please enter a valid email address." }, { status: 400 });
  }

  // Honeypot filled → pretend success, tell the bot nothing.
  if (parsed.data.company) {
    return Response.json({ message: "Subscribed." }, { status: 200 });
  }

  try {
    const response = await fetch("https://api.buttondown.com/v1/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email_address: parsed.data.email, tags: ["querypipe"] }),
    });

    if (response.status === 201) {
      return Response.json({ message: "Subscribed." }, { status: 200 });
    }

    const body = (await response.json().catch(() => null)) as { code?: string } | null;
    if (response.status === 400 && body?.code === "email_already_exists") {
      return Response.json({ message: "You're already subscribed." }, { status: 200 });
    }

    return Response.json(
      { message: "The newsletter provider rejected the request — please try again later." },
      { status: 502 },
    );
  } catch {
    return Response.json(
      { message: "The newsletter provider is unreachable — please try again later." },
      { status: 502 },
    );
  }
}
