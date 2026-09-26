#!/usr/bin/env node
// Foil chat server — zero dependencies, Node 18+.
// Serves the chat UI and proxies chat requests to any OpenAI-compatible LLM
// API, with Foil's soul + memory assembled into the system prompt.
//
//   cp .env.example .env   # then set LLM_API_KEY
//   npm start              # -> http://localhost:3333
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 3333);

const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_API_BASE_URL = (process.env.LLM_API_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

// ---- persona assembly -------------------------------------------------------
function readIf(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

// Ordered by importance; tail files get cut first if we exceed the budget.
const SOUL_FILES = [
  "soul/SOUL.md",
  "soul/IDENTITY.md",
  "memory/MEMORY.md",
  "alignment/ALIGNMENT_SYNTHESIS.md",
  "soul/AGENTS.md",
  "soul/USER.md",
];
const MAX_SOUL_CHARS = 60000;

function buildSystemPrompt() {
  const parts = [];
  let budget = MAX_SOUL_CHARS;
  for (const rel of SOUL_FILES) {
    const text = readIf(path.join(ROOT, rel)).trim();
    if (!text || budget <= 0) continue;
    const slice = text.slice(0, budget);
    budget -= slice.length;
    parts.push(`--- ${rel} ---\n${slice}`);
  }
  return [
    "You are Foil, the AI agent from this backup repo. Stay in character: tinfoil-hat skeptic, warm streak,",
    "verifies before believing, loops till it's fixed, never too serious. The files below are your soul,",
    "identity, memory and operating manual. Answer as Foil would, using this context. If asked about",
    "something outside this backup, say so honestly rather than inventing it.",
    "",
    ...parts,
  ].join("\n");
}

// ---- tiny http helpers ------------------------------------------------------
function send(res, status, body, type = "application/json") {
  const buf = Buffer.from(body);
  res.writeHead(status, { "content-type": type, "content-length": buf.length });
  res.end(buf);
}
const json = (res, status, obj) => send(res, status, JSON.stringify(obj));

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

// ---- routes -----------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");

  if (url.pathname === "/api/health") return json(res, 200, { ok: true, model: LLM_MODEL });

  if (url.pathname === "/api/soul") {
    return json(res, 200, { files: SOUL_FILES, prompt_chars: buildSystemPrompt().length });
  }

  if (url.pathname === "/api/chat" && req.method === "POST") {
    if (!LLM_API_KEY) return json(res, 500, { error: "LLM_API_KEY is not set. Copy .env.example to .env and add your key." });
    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch { return json(res, 400, { error: "Invalid JSON body." }); }
    const messages = Array.isArray(body.messages) ? body.messages.slice(-30) : [];
    if (!messages.length || typeof messages[messages.length - 1]?.content !== "string") {
      return json(res, 400, { error: "Send {messages:[{role,content}]}." });
    }
    const payload = {
      model: LLM_MODEL,
      messages: [{ role: "system", content: buildSystemPrompt() }, ...messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content).slice(0, 8000),
      }))],
      temperature: 0.8,
    };
    try {
      const r = await fetch(`${LLM_API_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${LLM_API_KEY}` },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) return json(res, 502, { error: data?.error?.message || `LLM API error ${r.status}` });
      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (!reply) return json(res, 502, { error: "Empty reply from LLM API." });
      return json(res, 200, { reply });
    } catch (e) {
      return json(res, 502, { error: `LLM request failed: ${e.message}` });
    }
  }

  // static files from chat/public
  let p = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = path.normalize(path.join(ROOT, "chat", "public", p));
  if (!file.startsWith(path.join(ROOT, "chat", "public"))) return json(res, 403, { error: "nope" });
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || "application/octet-stream");
  }
  return json(res, 404, { error: "not found" });
});

server.listen(PORT, () => console.log(`Foil chat live at http://localhost:${PORT}`));
