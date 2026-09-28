import { defineAction, z, type ActionsModule } from "@hatch/space-sdk";

const chainSchema = z.enum(["base", "ethereum", "robinhood"]);

const successSchema = z.object({
  status: z.literal("ok"),
  chain: chainSchema,
  chainLabel: z.string(),
  address: z.string(),
  analyzedAt: z.string(),
  source: z.string(),
  score: z.number().int().min(0).max(100),
  rating: z.string(),
  metrics: z.object({
    averageHoldDays: z.number().nonnegative(),
    flip7Percent: z.number().min(0).max(100),
    flip30Percent: z.number().min(0).max(100),
    flip7EligibleCycles: z.number().int().positive(),
    flip30EligibleCycles: z.number().int().positive(),
    averageTimeToSellDays: z.number().nonnegative().nullable(),
    totalDistinctNfts: z.number().int().nonnegative(),
    currentHoldings: z.number().int().nonnegative(),
    acquisitionCycles: z.number().int().nonnegative(),
    soldCycles: z.number().int().nonnegative(),
    longestHeld: z.object({
      contract: z.string(),
      tokenId: z.string(),
      collectionName: z.string().nullable(),
      durationDays: z.number().nonnegative(),
      ongoing: z.boolean(),
    }),
  }),
  formula: z.object({
    holdPoints: z.number().min(0).max(50),
    sevenDayPoints: z.number().min(0).max(30),
    thirtyDayPoints: z.number().min(0).max(20),
    explanation: z.string(),
  }),
  receipt: z.string(),
});

const noHistorySchema = z.object({
  status: z.literal("no_history"),
  chain: chainSchema,
  chainLabel: z.string(),
  address: z.string(),
  analyzedAt: z.string(),
  source: z.string(),
  message: z.string(),
});

const insufficientHistorySchema = z.object({
  status: z.literal("insufficient_history"),
  chain: chainSchema,
  chainLabel: z.string(),
  address: z.string(),
  analyzedAt: z.string(),
  source: z.string(),
  message: z.string(),
  currentHoldings: z.number().int().nonnegative(),
  acquisitionCycles: z.number().int().positive(),
  oldestHoldDays: z.number().nonnegative(),
  daysUntilEligible: z.number().int().nonnegative(),
});

const errorSchema = z.object({
  status: z.literal("error"),
  chain: chainSchema,
  chainLabel: z.string(),
  address: z.string(),
  analyzedAt: z.string(),
  source: z.string(),
  code: z.enum(["SOURCE_UNAVAILABLE", "HISTORY_TOO_LARGE", "INVALID_RESPONSE"]),
  message: z.string(),
});

const responseSchema = z.discriminatedUnion("status", [successSchema, noHistorySchema, insufficientHistorySchema, errorSchema]);
type AnalysisResponse = z.infer<typeof responseSchema>;
type Chain = z.infer<typeof chainSchema>;

type Transfer = {
  blockNumber: number;
  logIndex: number;
  timestampMs: number;
  from: string;
  to: string;
  contract: string;
  tokenId: string;
  collectionName: string | null;
};

type BlockscoutPayload = {
  items?: unknown[];
  next_page_params?: Record<string, string | number | boolean | null> | null;
};

type RpcResponse = {
  jsonrpc?: string;
  id?: number | string;
  result?: unknown;
  error?: { code?: number; message?: string };
};

class SourceFailure extends Error {
  constructor(
    message: string,
    readonly code: "SOURCE_UNAVAILABLE" | "HISTORY_TOO_LARGE" | "INVALID_RESPONSE" = "SOURCE_UNAVAILABLE",
  ) {
    super(message);
  }
}

const CHAINS: Record<Chain, { label: string; blockscout: string }> = {
  base: { label: "Base", blockscout: "https://base.blockscout.com" },
  ethereum: { label: "Ethereum", blockscout: "https://eth.blockscout.com" },
  robinhood: { label: "Robinhood Chain", blockscout: "https://robinhoodchain.blockscout.com" },
};

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ROBINHOOD_RPC = "https://rpc.mainnet.chain.robinhood.com";
const MAX_TRANSFERS = 1_000;
const MAX_BLOCKSCOUT_PAGES = 20;
const MAX_RPC_QUERIES = 120;
const MAX_RPC_RANGE_DEPTH = 24;

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 12_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 12_000): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchWithTimeout(url, init, timeoutMs);
  } catch {
    throw new SourceFailure("The chain data source did not respond in time.");
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    throw new SourceFailure(`The chain data source returned HTTP ${response.status}.`);
  }
  if (!contentType.toLowerCase().includes("json")) {
    throw new SourceFailure("The chain data source returned a non-data response.", "INVALID_RESPONSE");
  }
  try {
    return await response.json();
  } catch {
    throw new SourceFailure("The chain data source returned unreadable data.", "INVALID_RESPONSE");
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readAddress(value: unknown): string | null {
  const record = asRecord(value);
  const hash = record?.hash;
  return typeof hash === "string" && isAddress(hash) ? normalizeAddress(hash) : null;
}

function parseBlockscoutTransfer(value: unknown): Transfer {
  const item = asRecord(value);
  if (!item) throw new SourceFailure("A transfer row was malformed.", "INVALID_RESPONSE");
  const token = asRecord(item.token);
  const total = asRecord(item.total);
  const from = readAddress(item.from);
  const to = readAddress(item.to);
  const contract = typeof token?.address_hash === "string" ? normalizeAddress(token.address_hash) : "";
  const tokenIdValue = total?.token_id ?? item.token_id;
  const tokenId = typeof tokenIdValue === "string" || typeof tokenIdValue === "number" ? String(tokenIdValue) : "";
  const timestampMs = typeof item.timestamp === "string" ? Date.parse(item.timestamp) : Number.NaN;
  const blockNumber = typeof item.block_number === "number" ? item.block_number : Number(item.block_number);
  const logIndex = typeof item.log_index === "number" ? item.log_index : Number(item.log_index ?? 0);
  const tokenType = typeof token?.type === "string" ? token.type : "";
  if (!from || !to || !isAddress(contract) || !tokenId || !Number.isFinite(timestampMs) || !Number.isFinite(blockNumber) || !Number.isFinite(logIndex) || tokenType !== "ERC-721") {
    throw new SourceFailure("A transfer row was missing required ERC-721 fields.", "INVALID_RESPONSE");
  }
  return {
    blockNumber,
    logIndex,
    timestampMs,
    from,
    to,
    contract,
    tokenId,
    collectionName: typeof token?.name === "string" && token.name.trim() ? token.name.trim() : null,
  };
}

async function loadBlockscoutTransfers(chain: Chain, address: string): Promise<Transfer[]> {
  const base = `${CHAINS[chain].blockscout}/api/v2/addresses/${address}/token-transfers`;
  let next: Record<string, string | number | boolean | null> | null = null;
  const rows: Transfer[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < MAX_BLOCKSCOUT_PAGES; page += 1) {
    const url = new URL(base);
    url.searchParams.set("type", "ERC-721");
    if (next) {
      for (const [key, value] of Object.entries(next)) {
        if (value !== null) url.searchParams.set(key, String(value));
      }
    }
    const payload = asRecord(await fetchJson(url.toString())) as BlockscoutPayload | null;
    if (!payload || !Array.isArray(payload.items)) {
      throw new SourceFailure("The explorer returned an unexpected response.", "INVALID_RESPONSE");
    }
    for (const raw of payload.items) {
      const transfer = parseBlockscoutTransfer(raw);
      const key = `${transfer.blockNumber}:${transfer.logIndex}:${transfer.contract}:${transfer.tokenId}`;
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(transfer);
      }
    }
    next = payload.next_page_params && typeof payload.next_page_params === "object" ? payload.next_page_params : null;
    if (!next) return rows;
    if (rows.length >= MAX_TRANSFERS) {
      throw new SourceFailure("This wallet has more than 1,000 NFT transfers, so a complete score would be unsafe.", "HISTORY_TOO_LARGE");
    }
  }
  throw new SourceFailure("This wallet has more history than can be scored safely in one scan.", "HISTORY_TOO_LARGE");
}

async function rpcCall(method: string, params: unknown[], budget: { used: number }): Promise<unknown> {
  budget.used += 1;
  if (budget.used > MAX_RPC_QUERIES) {
    throw new SourceFailure("Robinhood Chain history exceeded the safe live-query budget.", "HISTORY_TOO_LARGE");
  }
  const payload = await fetchJson(
    ROBINHOOD_RPC,
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: budget.used, method, params }),
    },
    10_000,
  );
  const body = asRecord(payload) as RpcResponse | null;
  if (!body) throw new SourceFailure("Robinhood Chain returned an unexpected response.", "INVALID_RESPONSE");
  if (body.error) {
    const message = typeof body.error.message === "string" ? body.error.message : "RPC request failed";
    throw new SourceFailure(message, /limit|too many|range|exceed/i.test(message) ? "HISTORY_TOO_LARGE" : "SOURCE_UNAVAILABLE");
  }
  return body.result;
}

type RpcLog = {
  address?: unknown;
  blockNumber?: unknown;
  logIndex?: unknown;
  transactionHash?: unknown;
  topics?: unknown;
};

async function rpcLogsForRange(
  fromBlock: number,
  toBlock: number,
  topics: (string | null)[],
  budget: { used: number },
  depth = 0,
): Promise<RpcLog[]> {
  try {
    const result = await rpcCall(
      "eth_getLogs",
      [{ fromBlock: `0x${fromBlock.toString(16)}`, toBlock: `0x${toBlock.toString(16)}`, topics }],
      budget,
    );
    if (!Array.isArray(result)) throw new SourceFailure("Robinhood Chain returned malformed logs.", "INVALID_RESPONSE");
    return result as RpcLog[];
  } catch (error) {
    if (!(error instanceof SourceFailure) || error.code !== "HISTORY_TOO_LARGE" || fromBlock >= toBlock || depth >= MAX_RPC_RANGE_DEPTH) throw error;
    const midpoint = Math.floor((fromBlock + toBlock) / 2);
    const left = await rpcLogsForRange(fromBlock, midpoint, topics, budget, depth + 1);
    const right = await rpcLogsForRange(midpoint + 1, toBlock, topics, budget, depth + 1);
    return [...left, ...right];
  }
}

function topicAddress(topic: string): string | null {
  if (!/^0x[0-9a-fA-F]{64}$/.test(topic)) return null;
  return normalizeAddress(`0x${topic.slice(-40)}`);
}

function hexNumber(value: unknown): number | null {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) return null;
  const parsed = Number.parseInt(value.slice(2), 16);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function loadRobinhoodRpcTransfers(address: string): Promise<Transfer[]> {
  const budget = { used: 0 };
  const chainId = await rpcCall("eth_chainId", [], budget);
  if (chainId !== "0x1237") throw new SourceFailure("The Robinhood RPC reported the wrong chain.", "INVALID_RESPONSE");
  const latestRaw = await rpcCall("eth_blockNumber", [], budget);
  const latest = hexNumber(latestRaw);
  if (latest === null) throw new SourceFailure("Robinhood Chain returned an invalid block number.", "INVALID_RESPONSE");
  const padded = `0x${address.slice(2).padStart(64, "0")}`;
  const incoming = await rpcLogsForRange(0, latest, [TRANSFER_TOPIC, null, padded], budget);
  const outgoing = await rpcLogsForRange(0, latest, [TRANSFER_TOPIC, padded], budget);
  const unique = new Map<string, RpcLog>();
  for (const log of [...incoming, ...outgoing]) {
    const record = asRecord(log);
    const topics = record?.topics;
    if (!Array.isArray(topics) || topics.length !== 4 || !topics.every((topic) => typeof topic === "string")) continue;
    const key = `${String(record?.transactionHash)}:${String(record?.logIndex)}`;
    unique.set(key, log);
  }
  if (unique.size > MAX_TRANSFERS) {
    throw new SourceFailure("This wallet has more than 1,000 NFT transfers, so a complete score would be unsafe.", "HISTORY_TOO_LARGE");
  }

  const blockNumbers = new Set<number>();
  for (const log of unique.values()) {
    const block = hexNumber(log.blockNumber);
    if (block === null) throw new SourceFailure("Robinhood Chain returned a malformed log.", "INVALID_RESPONSE");
    blockNumbers.add(block);
  }
  const timestamps = new Map<number, number>();
  const blocks = [...blockNumbers];
  for (let index = 0; index < blocks.length; index += 20) {
    const slice = blocks.slice(index, index + 20);
    const results = await Promise.all(
      slice.map(async (block) => {
        const result = await rpcCall("eth_getBlockByNumber", [`0x${block.toString(16)}`, false], budget);
        const record = asRecord(result);
        const seconds = hexNumber(record?.timestamp);
        if (seconds === null) throw new SourceFailure("Robinhood Chain omitted a block timestamp.", "INVALID_RESPONSE");
        return [block, seconds * 1000] as const;
      }),
    );
    for (const [block, timestamp] of results) timestamps.set(block, timestamp);
  }

  const transfers: Transfer[] = [];
  for (const log of unique.values()) {
    const record = asRecord(log);
    const topics = Array.isArray(record?.topics) ? record.topics : [];
    const from = typeof topics[1] === "string" ? topicAddress(topics[1]) : null;
    const to = typeof topics[2] === "string" ? topicAddress(topics[2]) : null;
    const tokenIdRaw = typeof topics[3] === "string" ? topics[3] : "";
    const blockNumber = hexNumber(record?.blockNumber);
    const logIndex = hexNumber(record?.logIndex);
    const contract = typeof record?.address === "string" ? normalizeAddress(record.address) : "";
    if (!from || !to || blockNumber === null || logIndex === null || !isAddress(contract) || !/^0x[0-9a-fA-F]{64}$/.test(tokenIdRaw)) {
      throw new SourceFailure("Robinhood Chain returned a malformed NFT transfer.", "INVALID_RESPONSE");
    }
    const timestampMs = timestamps.get(blockNumber);
    if (timestampMs === undefined) throw new SourceFailure("Robinhood Chain omitted transfer timing.", "INVALID_RESPONSE");
    transfers.push({ blockNumber, logIndex, timestampMs, from, to, contract, tokenId: BigInt(tokenIdRaw).toString(), collectionName: null });
  }
  return transfers;
}

function ratingFor(score: number): string {
  if (score >= 80) return "Diamond Hands";
  if (score >= 60) return "Steady Holder";
  if (score >= 35) return "Active Flipper";
  return "Paper Hands";
}

function durationText(days: number): string {
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h`;
  if (days < 60) return `${round(days, 1)}d`;
  if (days < 730) return `${round(days / 30.4375, 1)}mo`;
  return `${round(days / 365.25, 1)}y`;
}

function computeReport(chain: Chain, address: string, source: string, transfers: Transfer[], analyzedAt: string): AnalysisResponse {
  const wallet = normalizeAddress(address);
  const sorted = [...transfers].sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
  type Cycle = { contract: string; tokenId: string; collectionName: string | null; startedAt: number; endedAt: number | null };
  const open = new Map<string, Cycle>();
  const cycles: Cycle[] = [];
  const distinct = new Set<string>();

  for (const event of sorted) {
    const inbound = event.to === wallet && event.from !== wallet;
    const outbound = event.from === wallet && event.to !== wallet;
    if (!inbound && !outbound) continue;
    const key = `${event.contract}:${event.tokenId}`;
    if (inbound) {
      if (!open.has(key)) {
        const cycle: Cycle = {
          contract: event.contract,
          tokenId: event.tokenId,
          collectionName: event.collectionName,
          startedAt: event.timestampMs,
          endedAt: null,
        };
        open.set(key, cycle);
        cycles.push(cycle);
        distinct.add(key);
      }
    } else {
      const cycle = open.get(key);
      if (cycle) {
        cycle.endedAt = Math.max(event.timestampMs, cycle.startedAt);
        open.delete(key);
      }
    }
  }

  const chainLabel = CHAINS[chain].label;
  if (cycles.length === 0) {
    return {
      status: "no_history",
      chain,
      chainLabel,
      address,
      analyzedAt,
      source,
      message: "No complete ERC-721 acquisition history was found for this wallet on this chain.",
    };
  }

  const now = Date.parse(analyzedAt);
  const DAY = 86_400_000;
  const durations = cycles.map((cycle) => ({ cycle, days: Math.max(0, ((cycle.endedAt ?? now) - cycle.startedAt) / DAY) }));
  const sold = durations.filter(({ cycle }) => cycle.endedAt !== null);
  const observedAges = cycles.map((cycle) => Math.max(0, (now - cycle.startedAt) / DAY));
  const sevenDayEligible = durations.filter((item) => item.cycle.endedAt !== null || (now - item.cycle.startedAt) / DAY >= 7);
  const thirtyDayEligible = durations.filter((item) => item.cycle.endedAt !== null || (now - item.cycle.startedAt) / DAY >= 30);
  if (thirtyDayEligible.length === 0) {
    const oldestHoldDays = Math.max(...observedAges);
    return {
      status: "insufficient_history",
      chain,
      chainLabel,
      address,
      analyzedAt,
      source,
      message: "This wallet has NFT activity, but none of its acquisitions has completed a 30-day observation window or exited yet. A score now would overstate its holding behavior.",
      currentHoldings: open.size,
      acquisitionCycles: cycles.length,
      oldestHoldDays: round(oldestHoldDays, 1),
      daysUntilEligible: Math.max(0, Math.ceil(30 - oldestHoldDays)),
    };
  }
  const averageHoldDays = durations.reduce((sum, item) => sum + item.days, 0) / durations.length;
  const averageTimeToSellDays = sold.length ? sold.reduce((sum, item) => sum + item.days, 0) / sold.length : null;
  const flip7Percent = (sevenDayEligible.filter((item) => item.cycle.endedAt !== null && item.days <= 7).length / sevenDayEligible.length) * 100;
  const flip30Percent = (thirtyDayEligible.filter((item) => item.cycle.endedAt !== null && item.days <= 30).length / thirtyDayEligible.length) * 100;
  const longest = durations.reduce((best, item) => (item.days > best.days ? item : best), durations[0] ?? { cycle: cycles[0] as Cycle, days: 0 });
  const holdPoints = 50 * Math.min(averageHoldDays / 365, 1);
  const sevenDayPoints = 30 * (1 - flip7Percent / 100);
  const thirtyDayPoints = 20 * (1 - flip30Percent / 100);
  const score = Math.max(0, Math.min(100, Math.round(holdPoints + sevenDayPoints + thirtyDayPoints)));
  const rating = ratingFor(score);
  const metrics = {
    averageHoldDays: round(averageHoldDays, 1),
    flip7Percent: round(flip7Percent, 1),
    flip30Percent: round(flip30Percent, 1),
    flip7EligibleCycles: sevenDayEligible.length,
    flip30EligibleCycles: thirtyDayEligible.length,
    averageTimeToSellDays: averageTimeToSellDays === null ? null : round(averageTimeToSellDays, 1),
    totalDistinctNfts: distinct.size,
    currentHoldings: open.size,
    acquisitionCycles: cycles.length,
    soldCycles: sold.length,
    longestHeld: {
      contract: longest.cycle.contract,
      tokenId: longest.cycle.tokenId,
      collectionName: longest.cycle.collectionName,
      durationDays: round(longest.days, 1),
      ongoing: longest.cycle.endedAt === null,
    },
  };
  const receipt = [
    `WALLET REPORT CARD — ${chainLabel.toUpperCase()}`,
    shortAddress(address),
    `${score}/100 · ${rating.toUpperCase()}`,
    `Avg hold ${durationText(metrics.averageHoldDays)} · 7d flips ${metrics.flip7Percent}% · 30d flips ${metrics.flip30Percent}%`,
    `${metrics.totalDistinctNfts} NFTs ever · ${metrics.currentHoldings} held now`,
    `Checked ${analyzedAt.slice(0, 10)} · ${source}`,
  ].join("\n");

  return {
    status: "ok",
    chain,
    chainLabel,
    address,
    analyzedAt,
    source,
    score,
    rating,
    metrics,
    formula: {
      holdPoints: round(holdPoints, 1),
      sevenDayPoints: round(sevenDayPoints, 1),
      thirtyDayPoints: round(thirtyDayPoints, 1),
      explanation: "50 × min(avg hold days ÷ 365, 1) + 30 × (1 − 7d flip rate) + 20 × (1 − 30d flip rate)",
    },
    receipt,
  };
}

export const Actions = {
  analyzeWallet: defineAction({
    request: z.object({
      address: z.string().trim().regex(/^0x[0-9a-fA-F]{40}$/, "Enter a valid 0x EVM wallet address."),
      chain: chainSchema,
    }),
    response: responseSchema,
    async handler(_ctx, args): Promise<AnalysisResponse> {
      const analyzedAt = new Date().toISOString();
      const address = args.address;
      const chainLabel = CHAINS[args.chain].label;
      try {
        if (args.chain === "robinhood") {
          try {
            const transfers = await loadBlockscoutTransfers(args.chain, address);
            return computeReport(args.chain, address, "Robinhood Blockscout", transfers, analyzedAt);
          } catch (blockscoutError) {
            try {
              const transfers = await loadRobinhoodRpcTransfers(normalizeAddress(address));
              return computeReport(args.chain, address, "Robinhood public RPC", transfers, analyzedAt);
            } catch (rpcError) {
              const failure = rpcError instanceof SourceFailure ? rpcError : new SourceFailure("Robinhood Chain data is unavailable right now.");
              return {
                status: "error",
                chain: args.chain,
                chainLabel,
                address,
                analyzedAt,
                source: "Robinhood Blockscout + public RPC",
                code: failure.code,
                message: failure.code === "HISTORY_TOO_LARGE"
                  ? failure.message
                  : "Robinhood Chain history could not be completed from either public source. No score was calculated.",
              };
            }
          }
        }
        const transfers = await loadBlockscoutTransfers(args.chain, address);
        return computeReport(args.chain, address, `${chainLabel} Blockscout`, transfers, analyzedAt);
      } catch (error) {
        const failure = error instanceof SourceFailure ? error : new SourceFailure("The chain data source is unavailable right now.");
        return {
          status: "error",
          chain: args.chain,
          chainLabel,
          address,
          analyzedAt,
          source: `${chainLabel} Blockscout`,
          code: failure.code,
          message: failure.message,
        };
      }
    },
  }),
} satisfies ActionsModule;
