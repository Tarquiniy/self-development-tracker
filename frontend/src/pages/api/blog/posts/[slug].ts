// frontend/src/pages/api/blog/posts/[slug].ts
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Proxy API route: /api/blog/posts/[slug] -> BACKEND/api/blog/posts/[slug]/
 *
 * Uses env:
 *  - NEXT_PUBLIC_BACKEND_URL
 *  - NEXT_PUBLIC_API_URL
 *  - NEXT_PUBLIC_API_BASE
 *
 * Returns exact JSON returned by backend (status preserved).
 */

const getBackendBase = () =>
  (process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "https://positive-theta.onrender.com").replace(/\/$/, "");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { slug } = req.query;
    if (!slug) {
      return res.status(400).json({ error: "missing slug" });
    }
    const slugStr = Array.isArray(slug) ? slug[0] : String(slug);

    const backendBase = getBackendBase();
    const targetUrl = `${backendBase}/api/blog/posts/${encodeURIComponent(slugStr)}/`;

    // Forward GET only (safe). For other methods you may extend similarly.
    const fetchOpts: RequestInit = {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    };

    const r = await fetch(targetUrl, fetchOpts);

    // preserve status and respond with JSON/text as-is
    const text = await r.text().catch(() => "");
    const contentType = r.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        const json = JSON.parse(text);
        return res.status(r.status).json(json);
      } catch {
        // if parse failed, return text
        return res.status(r.status).send(text);
      }
    } else {
      // non-json fallback (HTML, plain text)
      res.setHeader("content-type", contentType || "text/plain; charset=utf-8");
      return res.status(r.status).send(text);
    }
  } catch (err: any) {
    console.error("Proxy /api/blog/posts error:", err);
    return res.status(502).json({ error: "proxy_error", detail: String(err?.message ?? err) });
  }
}
