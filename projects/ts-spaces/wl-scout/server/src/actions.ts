import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { desc, eq } from "drizzle-orm";
import * as schema from "./schema";

const UA = "Mozilla/5.0 WLScout/1.0";
const CCFF00 = "0x505A22Ffed8d37ebE580FfD98d2Cdb0021189146";
const SEADROP = "0x00005EA00Ac477B1030CE78506496e8C2dE24bf5";
const CHAIN_ENDPOINTS: Record<number, string[]> = {
  4663: [
    "https://robinhood-rpc.publicnode.com",
    "https://rpc.mainnet.chain.robinhood.com",
    "https://rpc.nodeflare.app/robinhood/public",
  ],
  8453: [
    "https://mainnet.base.org",
    "https://base-rpc.publicnode.com",
    "https://base.meowrpc.com",
  ],
};

const PROJECTS = [
  {
    name: "BroostersNFT",
    slug: "broostersnft",
    chainId: 4663,
    contract: "0xad56e25c6267e48bc5da326c1b2b7133107b6e4b",
    gateMin: 1,
    phase: "CCFF00 allowlist · FREE ×1 · 04 Oct 15:30–16:00 UTC",
    status: "watching",
    reason: "CCFF00 holders were explicitly named for the free allowlist; public phase is separately paid.",
  },
  {
    name: "Pixel Cats on Drugs",
    slug: "pixel-cats-on-drugs",
    chainId: 4663,
    contract: "0xc3652a719ed2b5e2543693a9d7869b93231ba24d",
    gateMin: 4,
    phase: "CCFF00 4+ / Sknots 3+ · offchain gate",
    status: "lead-only",
    reason: "The tracked gate requires four CCFF00 squares; its public phase was paid and the project had no verified social presence.",
  },
  {
    name: "MeowzNFTs Official",
    slug: "meowznfts-official",
    chainId: 4663,
    contract: "0xa0412bbfbdcc79ca9e824ac7ddd216ab7736df7a",
    gateMin: null,
    phase: "CCFF00 top-3000 GTD window closed; paid public phase recorded",
    status: "claimed+forwarded",
    reason: "Eligibility was checker-issued and token-rank based; a current holder balance alone cannot prove it.",
  },
  {
    name: "Little Guys",
    slug: "little-guys-",
    chainId: 4663,
    contract: "0x797d93d5a2497a062bdc823f56a3571b0893b635",
    gateMin: null,
    phase: "CCFF00 partner GTD closed; public phase paid",
    status: "blocked",
    reason: "The recorded OpenSea eligibility check refused the tracked wallet; the public phase exceeded the cap.",
  },
  {
    name: "Pixel Masks",
    slug: "pixel-masks-138404901",
    chainId: 4663,
    contract: "0x0ffa97946311ab68aa6623407a7ec7b55c943c62",
    gateMin: null,
    phase: "CCFF00 GTD was signed-presale; public phase paid",
    status: "lead-only",
    reason: "Signed-presale membership is offchain and the tracked project identity was unverified.",
  },
  {
    name: "FF9A00 Jacks",
    slug: "ff9a00-jacks",
    chainId: 4663,
    contract: "0x774ca2da605548c21484ee396ffc07e5604907b1",
    gateMin: null,
    phase: "CCFF00 offchain WL ended; public phase paid",
    status: "lead-only",
    reason: "The offchain gate ended and the project failed the recorded quality check.",
  },
  {
    name: "DOUX & CCFFOO",
    slug: "doux-bebe",
    chainId: 4663,
    contract: "0xc500d1940cdb7e8988ce99df962bd5dc4cb2ecc7",
    gateMin: null,
    phase: "GTD FREE phase ended; mechanics unverified",
    status: "blocked/lead-only",
    reason: "The recorded GTD mechanics were not proven onchain and the project had no verified identity links.",
  },
] as const;

const alertTypeSchema = z.enum([
  "wl_open",
  "ending_soon",
  "ccff00_new",
  "raffle_deadline",
]);
const healthSchema = z.object({
  leg: z.string(),
  status: z.enum(["ok", "degraded", "down"]),
  endpoint: z.string().nullable(),
  lastSuccess: z.string().nullable(),
  failures: z.number().int().nonnegative(),
  error: z.string().nullable(),
});
const checklistSchema = z.object({
  id: z.string(),
  label: z.string(),
  url: z.string().nullable(),
  source: z.string(),
});
const feedItemSchema = z.object({
  id: z.string(),
  kind: z.enum(["mint", "raffle"]),
  project: z.string(),
  chain: z.string(),
  chainId: z.number().int(),
  contract: z.string().nullable(),
  phase: z.string(),
  state: z.string(),
  price: z.string(),
  priceVerified: z.boolean(),
  free: z.boolean(),
  wlGated: z.boolean(),
  ccff00: z.boolean(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  limit: z.number().int().nullable(),
  entrants: z.number().int().nullable(),
  winners: z.number().int().nullable(),
  gtd: z.number().int().nullable(),
  fcfs: z.number().int().nullable(),
  source: z.string(),
  sourceUrl: z.string().nullable(),
  xHandle: z.string().nullable(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  checklist: z.array(checklistSchema),
  stale: z.boolean(),
});
const scanRowSchema = z.object({
  id: z.string(),
  project: z.string(),
  contract: z.string(),
  verdict: z.enum(["ELIGIBLE", "NOT_ELIGIBLE", "CHECKER", "UNKNOWN", "INELIGIBLE_BY_GATE"]),
  gate: z.string(),
  phase: z.string(),
  price: z.string(),
  why: z.string(),
  state: z.string(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  checklist: z.array(checklistSchema),
  intel: z.array(z.object({ source: z.string(), detail: z.string(), asOf: z.string(), url: z.string().nullable(), status: z.enum(["verified", "lead", "thin"]) })),
  stale: z.boolean(),
  probedAt: z.string(),
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();
const isAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);
const word = (value: string) => value.replace(/^0x/, "").padStart(64, "0");
const encodeAddress = (selector: string, address: string) => `${selector}${word(address.slice(2).toLowerCase())}`;
const safeHttpUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
};
const decodeEntities = (value: string) => value
  .replaceAll("&amp;", "&")
  .replaceAll("&quot;", '"')
  .replaceAll("&#39;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">");
const attr = (html: string, name: string) => {
  const match = html.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match?.[1] ? decodeEntities(match[1]) : null;
};
const textFrom = (html: string, pattern: RegExp) => {
  const match = html.match(pattern);
  return match?.[1] ? decodeEntities(match[1].replace(/<[^>]+>/g, "").trim()) : null;
};

async function rpcRequest(chainId: number, method: string, params: unknown[], deadlineMs = 20_000) {
  const endpoints = CHAIN_ENDPOINTS[chainId] ?? [];
  const started = Date.now();
  const errors: string[] = [];
  const backoffs = [0, 500, 2_000, 8_000];
  for (const delay of backoffs) {
    if (delay > 0) await sleep(Math.min(delay, Math.max(0, deadlineMs - (Date.now() - started))));
    for (const endpoint of endpoints) {
      const remaining = deadlineMs - (Date.now() - started);
      if (remaining <= 0) break;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(4_000, remaining));
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", "User-Agent": UA },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          signal: controller.signal,
        });
        const body = await response.text();
        if (!response.ok || !body.trim()) throw new Error(`HTTP ${response.status}`);
        const parsed = JSON.parse(body) as { result?: unknown; error?: { message?: string } };
        if (parsed.error || parsed.result === undefined) throw new Error(parsed.error?.message ?? "empty RPC result");
        return { result: parsed.result, endpoint, errors };
      } catch (error) {
        errors.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        clearTimeout(timer);
      }
    }
  }
  throw new Error(errors.at(-1) ?? "all RPC endpoints failed");
}

function parseRadar(html: string, asOf: string): z.infer<typeof feedItemSchema>[] {
  const rows: z.infer<typeof feedItemSchema>[] = [];
  const articleMatches = html.matchAll(/<article\b([\s\S]*?)<\/article>/gi);
  for (const articleMatch of articleMatches) {
    const article = articleMatch[0];
    const open = article.slice(0, article.indexOf(">") + 1);
    const chain = attr(open, "data-chain") ?? "unknown";
    const chainId = chain.toLowerCase().includes("robinhood") ? 4663 : chain.toLowerCase().includes("base") ? 8453 : 0;
    if (chainId === 0) continue;
    const project = textFrom(article, /<h1\b[^>]*class="[^"]*name[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ?? attr(open, "title") ?? "Unnamed project";
    const contract = attr(open, "data-addr");
    const slug = attr(open, "data-slug") ?? contract ?? project.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const links: { label: string; url: string }[] = [];
    for (const linkMatch of article.matchAll(/<a\b([^>]*href="[^"]+"[^>]*)>/gi)) {
      const tag = linkMatch[1] ?? "";
      const url = safeHttpUrl(attr(tag, "href"));
      if (!url || links.some((item) => item.url === url)) continue;
      const aria = attr(tag, "aria-label") ?? "Source link";
      const label = url.includes("opensea.io") ? "OpenSea" : url.includes("x.com") ? "Project X" : url.includes("discord") ? "Discord" : aria.split(",")[0] ?? "Source";
      links.push({ label, url });
    }
    for (const gateMatch of article.matchAll(/<div\b([^>]*class="[^"]*gate[^"]*"[^>]*)>/gi)) {
      const tag = gateMatch[1] ?? "";
      const title = attr(tag, "title");
      if (!title || !attr(tag, "data-uuid")) continue;
      const priceRaw = Number(attr(tag, "data-price") ?? "NaN");
      const free = Number.isFinite(priceRaw) && priceRaw === 0;
      const lower = title.toLowerCase();
      const wlGated = /(white\s?list|allowlist|gtd|og\b|\bwl\b|ccff00|ccffoo|fcfs)/i.test(title) && !/^public/i.test(title);
      const ccff00 = /ccff00|ccffoo/i.test(title);
      const startMs = Number(attr(tag, "data-start") ?? "NaN");
      const endMs = Number(attr(tag, "data-end") ?? "NaN");
      const limitRaw = Number(attr(tag, "data-limit") ?? "NaN");
      const state = attr(tag, "data-state") ?? "unknown";
      const sourceUrl = links.find((link) => link.label === "OpenSea")?.url ?? links[0]?.url ?? null;
      const checklist: z.infer<typeof checklistSchema>[] = [];
      if (wlGated) {
        const x = links.find((link) => link.label === "Project X");
        const discord = links.find((link) => link.label === "Discord");
        const site = links.find((link) => !["Project X", "Discord", "OpenSea"].includes(link.label));
        if (x) checklist.push({ id: `${slug}-x`, label: "Review the official X post; follow / like / repost only when required", url: x.url, source: "project X" });
        if (discord) checklist.push({ id: `${slug}-discord`, label: "Join the linked Discord and read the raffle or allowlist instructions", url: discord.url, source: "radar metadata" });
        if (site) checklist.push({ id: `${slug}-checker`, label: "Open the project site or checker and verify the pasted wallet", url: site.url, source: "radar metadata" });
        const os = links.find((link) => link.label === "OpenSea");
        if (os) checklist.push({ id: `${slug}-opensea`, label: "Open the OpenSea phase page and confirm the active window", url: os.url, source: "OpenSea link" });
        checklist.push({ id: `${slug}-address`, label: "Prepare the public wallet address for any required address-drop", url: null, source: "work-through step" });
      }
      rows.push({
        id: `mint:${slug}:${attr(tag, "data-uuid")}`,
        kind: "mint",
        project,
        chain,
        chainId,
        contract: contract && isAddress(contract) ? contract : null,
        phase: title,
        state,
        price: free ? "FREE" : Number.isFinite(priceRaw) ? `${priceRaw} ETH` : "unavailable",
        priceVerified: false,
        free,
        wlGated,
        ccff00,
        startsAt: Number.isFinite(startMs) ? new Date(startMs).toISOString() : null,
        endsAt: Number.isFinite(endMs) ? new Date(endMs).toISOString() : null,
        limit: Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : null,
        entrants: null,
        winners: null,
        gtd: null,
        fcfs: null,
        source: "NFT Trencher radar",
        sourceUrl,
        xHandle: null,
        links: links.slice(0, 5),
        checklist,
        stale: false,
      });
      if (rows.length >= 100) return rows;
    }
  }
  return rows;
}

type RafflePayload = {
  base?: {
    raffles?: Array<Record<string, unknown>>;
    discord?: unknown;
    site?: unknown;
    x?: unknown;
  };
};
function parseRaffles(payload: RafflePayload): z.infer<typeof feedItemSchema>[] {
  const raffles = Array.isArray(payload.base?.raffles) ? payload.base?.raffles ?? [] : [];
  const discordUrl = safeHttpUrl(payload.base?.discord);
  const siteUrl = safeHttpUrl(payload.base?.site);
  return raffles.flatMap((row) => {
    const live = row.live === true || row.status === "live" || row.status === "waiting";
    const mintEth = typeof row.mint_eth === "number" ? row.mint_eth : null;
    if (!live || mintEth !== 0) return [];
    const project = typeof row.collection === "string" ? row.collection : "Unnamed raffle";
    const id = typeof row.id === "string" ? row.id : `${project}-${String(row.ts ?? "")}`;
    const chain = typeof row.chain === "string" ? row.chain : "unknown";
    const ts = typeof row.ts === "number" ? row.ts * 1000 : null;
    const links: { label: string; url: string }[] = [];
    if (discordUrl) links.push({ label: "Entry Discord", url: discordUrl });
    if (siteUrl) links.push({ label: "Source site", url: siteUrl });
    const xHandle = typeof row.twitter === "string" ? row.twitter : null;
    const checklist: z.infer<typeof checklistSchema>[] = [];
    if (discordUrl) checklist.push({ id: `${id}-discord`, label: "Open the raffle Discord and read the entry card", url: discordUrl, source: "radar raffles" });
    if (xHandle) checklist.push({ id: `${id}-x`, label: `Review @${xHandle} for the official project post`, url: null, source: "radar raffles" });
    checklist.push({ id: `${id}-address`, label: "Use only the public wallet address when an address-drop is requested", url: null, source: "work-through step" });
    return [{
      id: `raffle:${id}`,
      kind: "raffle" as const,
      project,
      chain,
      chainId: chain.toLowerCase().includes("robinhood") ? 4663 : chain.toLowerCase().includes("base") ? 8453 : 0,
      contract: typeof row.contract === "string" && isAddress(row.contract) ? row.contract : null,
      phase: typeof row.note === "string" && row.note.trim() ? row.note : "Free-entry raffle",
      state: typeof row.status === "string" ? row.status : "unknown",
      price: "FREE",
      priceVerified: false,
      free: true,
      wlGated: true,
      ccff00: false,
      startsAt: null,
      endsAt: ts ? new Date(ts).toISOString() : null,
      limit: null,
      entrants: typeof row.entrants === "number" ? Math.trunc(row.entrants) : null,
      winners: typeof row.winners === "number" ? Math.trunc(row.winners) : null,
      gtd: typeof row.gtd === "number" ? Math.trunc(row.gtd) : null,
      fcfs: typeof row.fcfs === "number" ? Math.trunc(row.fcfs) : null,
      source: "NFT Trencher raffles",
      sourceUrl: siteUrl,
      xHandle,
      links,
      checklist,
      stale: false,
    }];
  });
}

async function fetchFeeds(ctx: Ctx) {
  const db = ctx.db<typeof schema>();
  const cachedRows = await db.select().from(schema.feedSnapshots).where(eq(schema.feedSnapshots.id, "latest")).limit(1);
  const cached = cachedRows[0];
  if (cached && Date.now() - cached.fetchedAt.getTime() < 60_000) {
    try {
      const parsed = JSON.parse(cached.payload) as { radar: z.infer<typeof feedItemSchema>[]; raffles: z.infer<typeof feedItemSchema>[]; health: z.infer<typeof healthSchema>[]; asOf: string };
      return parsed;
    } catch {
      // Refresh below.
    }
  }
  const asOf = nowIso();
  let radar: z.infer<typeof feedItemSchema>[] = [];
  let raffles: z.infer<typeof feedItemSchema>[] = [];
  const health: z.infer<typeof healthSchema>[] = [];
  let radarError: string | null = null;
  let raffleError: string | null = null;
  try {
    const versionResponse = await fetch("https://cdn.neverfuckingtrade.com/version.json", { headers: { "User-Agent": UA } });
    if (!versionResponse.ok) throw new Error(`HTTP ${versionResponse.status}`);
    const version = await versionResponse.json() as { v?: number };
    if (!version.v) throw new Error("version missing");
    const feedResponse = await fetch(`https://cdn.neverfuckingtrade.com/feed.html?v=${version.v}`, { headers: { "User-Agent": UA, "Accept-Encoding": "gzip, deflate, br" } });
    if (!feedResponse.ok) throw new Error(`HTTP ${feedResponse.status}`);
    radar = parseRadar(await feedResponse.text(), asOf);
    health.push({ leg: "Radar CDN", status: "ok", endpoint: "cdn.neverfuckingtrade.com", lastSuccess: asOf, failures: 0, error: null });
  } catch (error) {
    radarError = error instanceof Error ? error.message : String(error);
    health.push({ leg: "Radar CDN", status: "down", endpoint: "cdn.neverfuckingtrade.com", lastSuccess: cached?.fetchedAt.toISOString() ?? null, failures: 1, error: radarError });
  }
  try {
    const raffleResponse = await fetch(`https://cdn.neverfuckingtrade.com/raffles/data.json?t=${Math.floor(Date.now() / 1000)}`, { headers: { "User-Agent": UA, "Accept-Encoding": "gzip, deflate, br" } });
    if (!raffleResponse.ok) throw new Error(`HTTP ${raffleResponse.status}`);
    raffles = parseRaffles(await raffleResponse.json() as RafflePayload);
    health.push({ leg: "Raffles feed", status: "ok", endpoint: "cdn.neverfuckingtrade.com", lastSuccess: asOf, failures: 0, error: null });
  } catch (error) {
    raffleError = error instanceof Error ? error.message : String(error);
    health.push({ leg: "Raffles feed", status: "down", endpoint: "cdn.neverfuckingtrade.com", lastSuccess: cached?.fetchedAt.toISOString() ?? null, failures: 1, error: raffleError });
  }
  if ((radarError || raffleError) && cached) {
    try {
      const prior = JSON.parse(cached.payload) as { radar: z.infer<typeof feedItemSchema>[]; raffles: z.infer<typeof feedItemSchema>[] };
      if (radarError) radar = prior.radar.map((row) => ({ ...row, stale: true }));
      if (raffleError) raffles = prior.raffles.map((row) => ({ ...row, stale: true }));
    } catch {
      // Honest empty/down state remains.
    }
  }
  const result = { radar, raffles, health, asOf };
  await db.insert(schema.feedSnapshots).values({ id: "latest", payload: JSON.stringify(result), fetchedAt: new Date(asOf) }).onConflictDoUpdate({ target: schema.feedSnapshots.id, set: { payload: JSON.stringify(result), fetchedAt: new Date(asOf) } });
  return result;
}

async function scanProject(chainId: number, project: { name: string; slug: string; contract: string; gateMin: number | null; phase: string; status: string; reason: string }, squareBalance: number | null, live?: z.infer<typeof feedItemSchema>) {
  const probedAt = nowIso();
  const links = live?.links ?? [];
  const intel: z.infer<typeof scanRowSchema>["intel"] = [
    { source: "tracked pipeline", detail: project.reason, asOf: probedAt, url: null, status: "verified" },
  ];
  if (live) intel.unshift({ source: "NFT Trencher radar", detail: live.phase, asOf: probedAt, url: live.sourceUrl, status: "lead" });
  let verdict: z.infer<typeof scanRowSchema>["verdict"] = "UNKNOWN";
  let why = project.reason;
  let gate = project.gateMin ? `CCFF00 ×${project.gateMin}+` : "OFFCHAIN / SIGNED";
  let stale = false;
  let price = live?.price ?? "not re-probed";
  let state = live?.state ?? project.status;
  let startsAt = live?.startsAt ?? null;
  let endsAt = live?.endsAt ?? null;
  if (project.gateMin !== null && chainId === 4663 && squareBalance !== null) {
    verdict = squareBalance >= project.gateMin ? "ELIGIBLE" : "INELIGIBLE_BY_GATE";
    why = squareBalance >= project.gateMin
      ? `Wallet holds ${squareBalance} CCFF00 square${squareBalance === 1 ? "" : "s"}; holder gate requires ${project.gateMin}. Verified by balanceOf.`
      : `Wallet holds ${squareBalance} CCFF00 square${squareBalance === 1 ? "" : "s"}; holder gate requires ${project.gateMin}.`;
  }
  try {
    const callData = encodeAddress("0xbc6a629c", project.contract);
    const rootData = encodeAddress("0x32bf11f5", project.contract);
    const [drop, root] = await Promise.all([
      rpcRequest(chainId, "eth_call", [{ to: SEADROP, data: callData }, "latest"], 20_000),
      rpcRequest(chainId, "eth_call", [{ to: SEADROP, data: rootData }, "latest"], 20_000),
    ]);
    const raw = typeof drop.result === "string" ? drop.result.replace(/^0x/, "") : "";
    const words = raw.match(/.{1,64}/g) ?? [];
    if (words.length >= 4) {
      const p = BigInt(`0x${words[0] ?? "0"}`);
      const start = Number(BigInt(`0x${words[1] ?? "0"}`));
      const end = Number(BigInt(`0x${words[2] ?? "0"}`));
      price = p === 0n ? "FREE · onchain public phase" : `${Number(p) / 1e18} ETH · onchain public phase`;
      if (start > 0) startsAt = new Date(start * 1000).toISOString();
      if (end > 0) endsAt = new Date(end * 1000).toISOString();
      if (start > 0 || end > 0) state = Date.now() / 1000 < start ? "upcoming" : Date.now() / 1000 <= end ? "live" : "ended";
    }
    const rootValue = typeof root.result === "string" ? root.result : "0x0";
    if (project.gateMin === null && !/^0x0+$/.test(rootValue) && /^0x[0-9a-f]+$/i.test(rootValue)) {
      verdict = links.some((link) => !link.url.includes("opensea.io") && !link.url.includes("x.com") && !link.url.includes("discord")) ? "CHECKER" : "UNKNOWN";
      why = verdict === "CHECKER" ? "A non-zero allowlist root proves a gated phase exists; only the linked project checker can issue this wallet's proof." : "A non-zero allowlist root proves a gated phase exists, but no checker route was found.";
      gate = "MERKLE ALLOWLIST";
    }
    intel.push({ source: "Robinhood RPC", detail: `SeaDrop public phase and allowlist root probed via ${drop.endpoint}.`, asOf: probedAt, url: null, status: "verified" });
  } catch (error) {
    stale = true;
    if (verdict !== "ELIGIBLE" && verdict !== "INELIGIBLE_BY_GATE") verdict = "UNKNOWN";
    why = `${why} Contract probe timed out or failed; this row is stale, not a negative result.`;
  }
  if (verdict === "UNKNOWN" && live?.wlGated && live.checklist.some((item) => item.url && item.id.endsWith("-checker"))) verdict = "CHECKER";
  const checklist = live?.checklist.length ? live.checklist : [
    ...links.map((link, index) => ({
      id: `${project.slug}-source-${index}`,
      label: link.label === "Project X" ? "Review the official X post and complete only the stated requirements" : link.label === "OpenSea" ? "Open the phase page and confirm the active window" : "Open the official project route and look for its wallet checker",
      url: link.url,
      source: link.label,
    })),
    { id: `${project.slug}-address`, label: "Use only the public address with an official checker", url: null, source: "work-through step" },
  ];
  return {
    id: project.slug,
    project: project.name,
    contract: project.contract,
    verdict,
    gate,
    phase: live?.phase ?? project.phase,
    price,
    why,
    state,
    startsAt,
    endsAt,
    links,
    checklist,
    intel,
    stale,
    probedAt,
  } satisfies z.infer<typeof scanRowSchema>;
}

const scanResponse = z.object({
  wallet: z.object({ address: z.string(), chainId: z.number().int(), balance: z.string(), squareBalance: z.number().int().nullable(), owns4429: z.boolean(), blockNumber: z.string(), rpcEndpoint: z.string() }),
  rows: z.array(scanRowSchema),
  health: z.array(healthSchema),
  asOf: z.string(),
  degraded: z.boolean(),
});

const feedResponse = z.object({ radar: z.array(feedItemSchema), raffles: z.array(feedItemSchema), health: z.array(healthSchema), asOf: z.string() });
const subscriptionSchema = z.object({ id: z.string(), address: z.string(), chainId: z.number().int(), alertTypes: z.array(alertTypeSchema), active: z.boolean(), createdAt: z.string() });
const alertSchema = z.object({ id: z.number().int(), subscriptionId: z.string(), type: alertTypeSchema, project: z.string(), chainId: z.number().int(), detail: z.string(), url: z.string().nullable(), eventAt: z.string().nullable(), createdAt: z.string(), readAt: z.string().nullable() });

export const Actions = {
  scanWallet: defineAction({
    request: z.object({ address: z.string(), chainId: z.union([z.literal(4663), z.literal(8453)]) }),
    response: scanResponse,
    async handler(ctx, args): Promise<z.infer<typeof scanResponse>> {
      if (!isAddress(args.address)) throw new Error("Enter a valid 0x wallet address (40 hex characters).");
      const address = args.address.toLowerCase();
      const asOf = nowIso();
      const health: z.infer<typeof healthSchema>[] = [];
      let balance = "unavailable";
      let squareBalance: number | null = null;
      let owns4429 = false;
      let blockNumber = "unavailable";
      let rpcEndpoint = "unavailable";
      try {
        const [bal, block] = await Promise.all([
          rpcRequest(args.chainId, "eth_getBalance", [address, "latest"]),
          rpcRequest(args.chainId, "eth_blockNumber", []),
        ]);
        rpcEndpoint = bal.endpoint;
        balance = `${Number(BigInt(String(bal.result))) / 1e18} ETH`;
        blockNumber = String(Number(BigInt(String(block.result))));
        if (args.chainId === 4663) {
          const square = await rpcRequest(4663, "eth_call", [{ to: CCFF00, data: encodeAddress("0x70a08231", address) }, "latest"]);
          squareBalance = Number(BigInt(String(square.result)));
          const owner = await rpcRequest(4663, "eth_call", [{ to: CCFF00, data: `0x6352211e${BigInt(4429).toString(16).padStart(64, "0")}` }, "latest"]);
          const ownerHex = String(owner.result).slice(-40).toLowerCase();
          owns4429 = ownerHex === address.slice(2).toLowerCase();
        }
        health.push({ leg: args.chainId === 4663 ? "Robinhood RPC" : "Base RPC", status: "ok", endpoint: rpcEndpoint, lastSuccess: asOf, failures: 0, error: null });
      } catch (error) {
        health.push({ leg: args.chainId === 4663 ? "Robinhood RPC" : "Base RPC", status: "down", endpoint: null, lastSuccess: null, failures: 1, error: error instanceof Error ? error.message : String(error) });
        health.push({ leg: args.chainId === 4663 ? "Base RPC" : "Robinhood RPC", status: "degraded", endpoint: null, lastSuccess: null, failures: 0, error: "Not checked in this scan" });
        health.push({ leg: "OpenSea drops", status: "degraded", endpoint: null, lastSuccess: null, failures: 0, error: "No runtime-safe API credential; phase metadata is skipped" });
        health.push({ leg: "GitHub/GitLab", status: "degraded", endpoint: null, lastSuccess: null, failures: 0, error: "Sparse enrichment runs on demand" });
        return { wallet: { address, chainId: args.chainId, balance, squareBalance, owns4429, blockNumber, rpcEndpoint }, rows: [], health, asOf, degraded: true };
      }
      health.push({ leg: args.chainId === 4663 ? "Base RPC" : "Robinhood RPC", status: "degraded", endpoint: null, lastSuccess: null, failures: 0, error: "Not checked in this scan" });
      const feeds = await fetchFeeds(ctx);
      health.push(...feeds.health);
      health.push({ leg: "OpenSea drops", status: "degraded", endpoint: null, lastSuccess: null, failures: 0, error: "OpenSea has phase metadata but no wallet-membership endpoint; runtime key not stored here" });
      health.push({ leg: "GitHub/GitLab", status: "degraded", endpoint: null, lastSuccess: null, failures: 0, error: "Thin scene coverage; checked only when INTEL opens" });
      const liveByContract = new Map(feeds.radar.filter((row) => row.contract).map((row) => [row.contract?.toLowerCase(), row]));
      const selected = PROJECTS.filter((project) => project.chainId === args.chainId);
      const rows = await Promise.all(selected.map((project) => scanProject(args.chainId, project, squareBalance, liveByContract.get(project.contract.toLowerCase()))));
      const order: Record<z.infer<typeof scanRowSchema>["verdict"], number> = { ELIGIBLE: 0, CHECKER: 1, UNKNOWN: 2, NOT_ELIGIBLE: 3, INELIGIBLE_BY_GATE: 4 };
      rows.sort((a, b) => order[a.verdict] - order[b.verdict]);
      return { wallet: { address, chainId: args.chainId, balance, squareBalance, owns4429, blockNumber, rpcEndpoint }, rows, health, asOf, degraded: health.some((leg) => leg.status !== "ok") || rows.some((row) => row.stale) };
    },
  }),

  getFeeds: defineAction({
    request: z.object({ limit: z.number().int().positive().max(100).default(60) }),
    response: feedResponse,
    async handler(ctx, args): Promise<z.infer<typeof feedResponse>> {
      const feeds = await fetchFeeds(ctx);
      const rank = (row: z.infer<typeof feedItemSchema>) => row.state === "live" ? 0 : row.state === "upcoming" || row.state === "waiting" ? 1 : 2;
      return { ...feeds, radar: feeds.radar.sort((a, b) => rank(a) - rank(b)).slice(0, args.limit), raffles: feeds.raffles.sort((a, b) => rank(a) - rank(b)).slice(0, args.limit) };
    },
  }),

  getIntel: defineAction({
    request: z.object({ project: z.string().min(1).max(120), contract: z.string().nullable() }),
    response: z.object({ facts: z.array(z.object({ source: z.string(), detail: z.string(), url: z.string().nullable(), asOf: z.string(), status: z.enum(["lead", "thin"])})), health: z.array(healthSchema) }),
    async handler(_ctx, args) {
      const asOf = nowIso();
      const facts: Array<{ source: string; detail: string; url: string | null; asOf: string; status: "lead" | "thin" }> = [];
      const health: z.infer<typeof healthSchema>[] = [];
      try {
        const query = encodeURIComponent(`${args.project} ${args.contract ?? "NFT"}`);
        const response = await fetch(`https://api.github.com/search/repositories?q=${query}&per_page=3`, { headers: { "User-Agent": UA, Accept: "application/vnd.github+json" } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json() as { items?: Array<{ full_name?: string; description?: string | null; html_url?: string; updated_at?: string }> };
        const items = payload.items ?? [];
        if (items.length === 0) facts.push({ source: "GitHub", detail: "No matching public repository found. Coverage is thin for this scene.", url: null, asOf, status: "thin" });
        for (const item of items) {
          const url = safeHttpUrl(item.html_url);
          if (url) facts.push({ source: "GitHub", detail: `${item.full_name ?? "Repository"}${item.description ? ` — ${item.description}` : ""}`, url, asOf: item.updated_at ?? asOf, status: "lead" });
        }
        health.push({ leg: "GitHub", status: "ok", endpoint: "api.github.com", lastSuccess: asOf, failures: 0, error: null });
      } catch (error) {
        health.push({ leg: "GitHub", status: "degraded", endpoint: "api.github.com", lastSuccess: null, failures: 1, error: error instanceof Error ? error.message : String(error) });
      }
      try {
        const query = encodeURIComponent(args.project);
        const response = await fetch(`https://gitlab.com/api/v4/projects?search=${query}&per_page=3`, { headers: { "User-Agent": UA } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json() as Array<{ name_with_namespace?: string; description?: string | null; web_url?: string; last_activity_at?: string }>;
        if (payload.length === 0) facts.push({ source: "GitLab", detail: "No matching public project found. This enrichment leg is intentionally low-priority.", url: null, asOf, status: "thin" });
        for (const item of payload) {
          const url = safeHttpUrl(item.web_url);
          if (url) facts.push({ source: "GitLab", detail: `${item.name_with_namespace ?? "Project"}${item.description ? ` — ${item.description}` : ""}`, url, asOf: item.last_activity_at ?? asOf, status: "lead" });
        }
        health.push({ leg: "GitLab", status: "ok", endpoint: "gitlab.com", lastSuccess: asOf, failures: 0, error: null });
      } catch (error) {
        health.push({ leg: "GitLab", status: "degraded", endpoint: "gitlab.com", lastSuccess: null, failures: 1, error: error instanceof Error ? error.message : String(error) });
      }
      return { facts, health };
    },
  }),

  subscribe: defineAction({
    request: z.object({ address: z.string(), chainId: z.union([z.literal(4663), z.literal(8453)]), alertTypes: z.array(alertTypeSchema).min(1) }),
    response: subscriptionSchema,
    async handler(ctx, args): Promise<z.infer<typeof subscriptionSchema>> {
      if (!isAddress(args.address)) throw new Error("Enter a valid public wallet address.");
      const db = ctx.db<typeof schema>();
      const address = args.address.toLowerCase();
      const now = new Date();
      const id = crypto.randomUUID();
      await db.insert(schema.subscriptions).values({ id, address, chainId: args.chainId, alertTypes: JSON.stringify(args.alertTypes), active: true, createdAt: now, updatedAt: now });
      ctx.invalidateQueries();
      return { id, address, chainId: args.chainId, alertTypes: args.alertTypes, active: true, createdAt: now.toISOString() };
    },
  }),

  unsubscribe: defineAction({
    request: z.object({ subscriptionId: z.string().uuid() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db.update(schema.subscriptions).set({ active: false, updatedAt: new Date() }).where(eq(schema.subscriptions.id, args.subscriptionId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getAlerts: defineAction({
    request: z.object({ since: z.string().nullable().default(null), subscriptionId: z.string().uuid(), limit: z.number().int().positive().max(200).default(60) }),
    response: z.object({ alerts: z.array(alertSchema), cursor: z.string().nullable() }),
    async handler(ctx, args) {
      const rows = await ctx.db<typeof schema>().select().from(schema.alerts).where(eq(schema.alerts.subscriptionId, args.subscriptionId)).orderBy(desc(schema.alerts.id)).limit(500);
      const sinceMs = args.since ? Date.parse(args.since) : Number.NaN;
      const filtered = rows.filter((row) => !Number.isFinite(sinceMs) || row.createdAt.getTime() > sinceMs).slice(0, args.limit);
      const alerts = filtered.map((row) => ({ id: row.id, subscriptionId: row.subscriptionId, type: row.type, project: row.project, chainId: row.chainId, detail: row.detail, url: row.url, eventAt: row.eventAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null }));
      return { alerts, cursor: alerts[0]?.createdAt ?? null };
    },
  }),

  markAlertsRead: defineAction({
    request: z.object({ subscriptionId: z.string().uuid() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db.update(schema.alerts).set({ readAt: new Date() }).where(eq(schema.alerts.subscriptionId, args.subscriptionId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getUpcoming: defineAction({
    request: z.object({ limit: z.number().int().positive().max(100).default(40) }),
    response: z.object({ items: z.array(feedItemSchema), asOf: z.string(), health: z.array(healthSchema) }),
    async handler(ctx, args) {
      const feeds = await fetchFeeds(ctx);
      const items = [...feeds.radar, ...feeds.raffles].filter((row) => row.endsAt && new Date(row.endsAt).getTime() >= Date.now()).sort((a, b) => new Date(a.endsAt ?? 0).getTime() - new Date(b.endsAt ?? 0).getTime()).slice(0, args.limit);
      return { items, asOf: feeds.asOf, health: feeds.health };
    },
  }),

  refreshAlerts: defineAction({
    request: z.object({}),
    response: z.object({ ok: z.literal(true), created: z.number().int(), asOf: z.string() }),
    async handler(ctx): Promise<{ ok: true; created: number; asOf: string }> {
      const db = ctx.db<typeof schema>();
      const feeds = await fetchFeeds(ctx);
      const current = [...feeds.radar.filter((row) => row.wlGated), ...feeds.raffles];
      const previousRows = await db.select().from(schema.feedSnapshots).where(eq(schema.feedSnapshots.id, "alert-baseline")).limit(1);
      const previous = previousRows[0];
      let previousKeys = new Set<string>();
      if (previous) {
        try { previousKeys = new Set(JSON.parse(previous.payload) as string[]); } catch { previousKeys = new Set(); }
      }
      const subscriptions = (await db.select().from(schema.subscriptions)).filter((row) => row.active);
      let created = 0;
      if (previous) {
        for (const sub of subscriptions) {
          const types = z.array(alertTypeSchema).parse(JSON.parse(sub.alertTypes));
          for (const item of current) {
            const isNew = !previousKeys.has(item.id);
            const endsMs = item.endsAt ? new Date(item.endsAt).getTime() : Number.NaN;
            const endingSoon = Number.isFinite(endsMs) && endsMs > Date.now() && endsMs - Date.now() <= 86_400_000;
            const candidates: Array<{ type: z.infer<typeof alertTypeSchema>; detail: string }> = [];
            if (isNew && item.kind === "mint" && item.wlGated) candidates.push({ type: "wl_open", detail: `${item.phase} · ${item.price} per aggregator (unverified)` });
            if (isNew && item.ccff00) candidates.push({ type: "ccff00_new", detail: `New CCFF00-gated lead: ${item.phase}` });
            if (endingSoon && item.kind === "mint") candidates.push({ type: "ending_soon", detail: `Mint window ends ${item.endsAt}` });
            if (endingSoon && item.kind === "raffle") candidates.push({ type: "raffle_deadline", detail: `Free raffle draw/deadline ${item.endsAt}` });
            for (const candidate of candidates) {
              if (!types.includes(candidate.type)) continue;
              const dedupeKey = `${candidate.type}:${item.id}:${item.endsAt ?? "none"}`;
              const result = await db.insert(schema.alerts).values({ subscriptionId: sub.id, dedupeKey, type: candidate.type, project: item.project, chainId: item.chainId, detail: candidate.detail, url: item.sourceUrl, eventAt: item.endsAt ? new Date(item.endsAt) : null, createdAt: new Date() }).onConflictDoNothing().returning({ id: schema.alerts.id });
              if (result.length > 0) created += 1;
            }
          }
        }
      }
      const keys = current.map((item) => item.id);
      await db.insert(schema.feedSnapshots).values({ id: "alert-baseline", payload: JSON.stringify(keys), fetchedAt: new Date(feeds.asOf) }).onConflictDoUpdate({ target: schema.feedSnapshots.id, set: { payload: JSON.stringify(keys), fetchedAt: new Date(feeds.asOf) } });
      if (created > 0) ctx.invalidateQueries();
      return { ok: true, created, asOf: feeds.asOf };
    },
  }),
} satisfies ActionsModule;
