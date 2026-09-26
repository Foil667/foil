/*
 * TINFOIL SCAN — detection engine
 * Foil's free wallet-drainer checker. "verify before you believe."
 *
 * Dual-runtime: works in Node 18+ AND in the browser. Zero dependencies.
 * Signature data is injected (signatures.json in Node, embedded copy in the web UI).
 *
 * Usage:
 *   import { scanPage, VERSION } from './tinfoil-scan.mjs';
 *   const report = scanPage({ url, html, scripts: [{ url, content }] }, signatures);
 *
 * Input contract:
 *   url     — the page URL that was scanned (string)
 *   html    — raw HTML of the page (string, may be truncated for huge pages)
 *   scripts — array of { url, content } for each loaded script; content may be null
 *             when only the URL list is available (URL-based heuristics still run)
 *   signatures — parsed signatures.json
 *
 * Output: { verdict: 'CLEAN'|'SUSPICIOUS'|'DANGEROUS', score: 0-100,
 *           findings: [{ severity, title, detail, evidence }], meta: {...} }
 *
 * Read-only by design: this module never touches window.ethereum, never signs,
 * never sends anything anywhere. It only reads strings you hand it.
 */

export const VERSION = '1.1.0';

const SEVERITY_ORDER = ['info', 'low', 'medium', 'high', 'critical'];

/** Normalize for lookalike comparison: lowercase, strip common confusables. */
function normalizeDomain(domain) {
  return String(domain || '')
    .toLowerCase()
    .replace(/^www\./, '')
    // common homoglyph normalizations
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/5/g, 's')
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w')
    .replace(/cl/g, 'd');
}

/** Classic Levenshtein distance. */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function snippet(text, idx, radius = 90) {
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + radius);
  let s = text.slice(start, end).replace(/\s+/g, ' ');
  if (s.length > 220) s = s.slice(0, 220) + '…';
  return s.trim();
}

function addFinding(findings, severity, title, detail, evidence) {
  findings.push({ severity, title, detail, evidence: (evidence || '').slice(0, 240) });
}

/**
 * Main scan. Returns the verdict object.
 */
export function scanPage(input, signatures) {
  const findings = [];
  const { url = '', html = '', scripts = [] } = input || {};
  const sig = signatures || {};
  const host = hostOf(url);

  // Bundle everything searchable: page HTML + every fetched script body.
  const bodies = [];
  if (html) bodies.push({ label: 'page html', text: html });
  for (const s of scripts) {
    if (s && s.content) bodies.push({ label: `script ${s.url || 'inline'}`, text: s.content });
  }
  const corpus = bodies.map((b) => b.text).join('\n');

  const matchIn = (pattern, flags) => {
    const re = new RegExp(pattern, flags || 'g');
    const hits = [];
    for (const b of bodies) {
      re.lastIndex = 0;
      const m = re.exec(b.text);
      if (m) hits.push({ label: b.label, idx: m.index, match: m[0] });
    }
    return hits;
  };

  // ── 1. Known drainer-kit code signatures ──────────────────────────────
  for (const cs of sig.code_signatures || []) {
    const flags = cs.match === 'regex-insensitive' || cs.match === 'literal-insensitive' ? 'gi' : 'g';
    const pattern = cs.match && cs.match.startsWith('literal')
      ? cs.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      : cs.pattern;
    const hits = matchIn(pattern, flags);
    if (hits.length) {
      const h = hits[0];
      addFinding(
        findings,
        cs.severity,
        `Known drainer-kit fingerprint: ${cs.kit}`,
        `${cs.detail} (signature id: ${cs.id}, confidence: ${cs.confidence}${cs.source ? ` — ${cs.source}` : ''})`,
        `${h.label}: …${snippet(bodies.find((b) => b.label === h.label).text, h.idx)}…`
      );
    }
  }

  // ── 2. Suspicious script filenames / sources ──────────────────────────
  for (const s of scripts) {
    if (!s || !s.url) continue;
    const file = s.url.split('/').pop().split('?')[0].toLowerCase();
    for (const fh of sig.script_filename_heuristics || []) {
      if (new RegExp(fh.pattern, 'i').test(file)) {
        addFinding(findings, fh.severity, `Suspicious script filename: ${file}`,
          `${fh.detail}${fh.note ? ' ' + fh.note : ''}`, s.url);
      }
    }
    // External script from a host that is neither the page host nor a known CDN.
    const sh = hostOf(s.url);
    if (sh && host && sh !== host && !isKnownCdn(sh) && !isLegit(sh, sig.legit_domains)) {
      addFinding(findings, 'low', `Third-party script from unfamiliar host: ${sh}`,
        'External scripts run with full page privileges. Unfamiliar hosts deserve a look before any wallet interaction.',
        s.url);
    }
  }

  // ── 3. Signature-request patterns (permit phishing) ────────────────────
  for (const sp of sig.signature_request_patterns || []) {
    const hits = matchIn(sp.pattern, 'g');
    if (hits.length) {
      const h = hits[0];
      addFinding(findings, sp.severity, `Signature-request pattern: ${sp.id}`,
        sp.detail, `${h.label}: …${snippet(bodies.find((b) => b.label === h.label).text, h.idx)}…`);
    }
  }

  // ── 4. Malicious approval patterns ─────────────────────────────────────
  const approvalCalls = [
    { re: /\bsetApprovalForAll\s*\(/g, sev: 'high', title: 'setApprovalForAll call in page JS',
      detail: 'Grants an operator rights over ALL of a wallet\u2019s NFTs in a collection. Legit marketplaces request this too — the question is always WHO the operator is.' },
    { re: /\bincreaseAllowance\s*\(/g, sev: 'high', title: 'increaseAllowance call in page JS',
      detail: 'Raises an ERC-20 allowance for a chosen spender. Drainers push it to unlimited.' },
    { re: /\bapprove\s*\(\s*['"]?0x[a-fA-F0-9]{40}/g, sev: 'medium', title: 'approve() to a hardcoded address in page JS',
      detail: 'An approval targeting a hardcoded spender address. Verify the spender is a contract you trust, not an EOA.' },
  ];
  for (const a of approvalCalls) {
    const hits = matchIn(a.re.source, 'g');
    if (hits.length) {
      const h = hits[0];
      addFinding(findings, a.sev, a.title, a.detail,
        `${h.label}: …${snippet(bodies.find((b) => b.label === h.label).text, h.idx)}…`);
    }
  }
  // Unlimited-allowance literals
  for (const lit of sig.unlimited_allowance_literals || []) {
    const pattern = lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hits = matchIn(pattern, 'g');
    if (hits.length) {
      const h = hits[0];
      addFinding(findings, 'high', 'Unlimited-allowance literal in page JS',
        `The code references a uint256-max style value (${lit}). Paired with an approve/permit call, this authorizes draining the entire token balance.`,
        `${h.label}: …${snippet(bodies.find((b) => b.label === h.label).text, h.idx)}…`);
    }
  }
  // Known-dangerous function selectors embedded in frontend code
  for (const [sel, info] of Object.entries(sig.function_selectors || {})) {
    const hits = matchIn(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    if (hits.length) {
      const h = hits[0];
      addFinding(findings, sel === '0xa22cb465' || sel === '0x095ea7b3' ? 'medium' : 'low',
        `Function selector ${sel} (${info.name}) referenced in page JS`,
        info.risk + ' Referenced in frontend code is not proof of misuse — but on a page you don\u2019t trust, it\u2019s a data point.',
        `${h.label}: …${snippet(bodies.find((b) => b.label === h.label).text, h.idx)}…`);
    }
  }

  // ── 5. Obfuscation indicators ──────────────────────────────────────────
  for (const oi of sig.obfuscation_indicators || []) {
    const hits = matchIn(oi.pattern, 'gi');
    if (hits.length > 0) {
      // Single eval on a big legit bundle is noise; require repetition or pair it down.
      if (oi.id === 'eval-usage' && hits.length < 2 && corpus.length < 200000) continue;
      if (oi.id === 'long-base64-blob' && hits.length < 1) continue;
      const h = hits[0];
      addFinding(findings, oi.severity, `Obfuscation indicator: ${oi.id}`,
        `${oi.detail} (${hits.length} occurrence${hits.length === 1 ? '' : 's'})`,
        `${h.label}: …${snippet(bodies.find((b) => b.label === h.label).text, h.idx)}…`);
    }
  }

  // ── 6. Red-flag page traits ────────────────────────────────────────────
  for (const pt of sig.page_trait_patterns || []) {
    if (pt.id === 'fake-connect-overlay') {
      // Only flag the connect-wallet prompt when the page ALSO shows drainer-ish signals,
      // otherwise every legit dapp would trip it. Handled in scoring context below.
      continue;
    }
    const hits = matchIn(pt.pattern, 'gi');
    if (hits.length) {
      const h = hits[0];
      addFinding(findings, pt.severity, `Page trait: ${pt.id}`, pt.detail,
        `${h.label}: …${snippet(bodies.find((b) => b.label === h.label).text, h.idx)}…`);
    }
  }

  // Wallet-connect prompt is info-level context on its own.
  {
    const hits = matchIn('connect\\s+wallet', 'gi');
    if (hits.length) {
      addFinding(findings, 'info', 'Page prompts wallet connection',
        'Normal for web3. The scan\u2019s job is what the page does AFTER you connect — review every finding above before signing anything.');
    }
  }

  // ── 7. Lookalike / typosquat domain check ──────────────────────────────
  if (host) {
    if (/^xn--/.test(host) || host.split('.').some((p) => /^xn--/.test(p))) {
      addFinding(findings, 'high', 'Punycode (IDN) domain',
        'The domain uses punycode — a classic homoglyph-attack technique (e.g. uniswap with a Cyrillic character). Treat as hostile until proven otherwise.',
        host);
    } else if (!isLegit(host, sig.legit_domains)) {
      const norm = normalizeDomain(host);
      let best = null;
      for (const legit of sig.legit_domains || []) {
        const ln = normalizeDomain(legit);
        // Compare registrable-ish: full host vs legit, and host-without-subdomain vs legit.
        const candidates = [norm, norm.split('.').slice(-2).join('.')];
        for (const c of candidates) {
          const d = levenshtein(c, ln);
          if (d <= 2 && c !== ln && (!best || d < best.d)) best = { legit, d };
        }
      }
      if (best) {
        addFinding(findings, 'high', `Lookalike domain: resembles ${best.legit}`,
          `Edit distance ${best.d} from a well-known legit domain. Typosquat/homoglyph domains are the #1 drainer delivery vehicle (fake DEX clones via paid ads, 2023–2026). Verify you typed the URL yourself.`,
          host);
      }
      // Brand-name-in-title/domain mismatch: page claims a brand it isn't.
      const brandHit = brandMismatch(html, host, sig.legit_domains || []);
      if (brandHit) {
        addFinding(findings, 'high', `Possible brand impersonation: "${brandHit}"`,
          `The page's title/branding references "${brandHit}" but the domain is ${host}, which is not the brand's official domain. This is the standard fake-mint / fake-airdrop lure.`,
          host);
      }
    }
  }

  // ── 8. Score + verdict ─────────────────────────────────────────────────
  const weights = (sig.scoring && sig.scoring.weights) || { critical: 45, high: 25, medium: 12, low: 5, info: 0 };
  const thresholds = (sig.scoring && sig.scoring.verdict_thresholds) || { suspicious: 35, dangerous: 70 };
  let score = 0;
  let criticals = 0;
  for (const f of findings) {
    score += weights[f.severity] || 0;
    if (f.severity === 'critical') criticals++;
  }
  score = Math.min(100, score);

  let verdict = 'CLEAN';
  if (score >= thresholds.dangerous || criticals >= 2) verdict = 'DANGEROUS';
  else if (score >= thresholds.suspicious || criticals >= 1) verdict = 'SUSPICIOUS';

  // De-dupe identical titles, keep highest severity first.
  const seen = new Set();
  const deduped = [];
  for (const f of [...findings].sort((a, b) =>
    SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity))) {
    if (seen.has(f.title)) continue;
    seen.add(f.title);
    deduped.push(f);
  }

  return {
    verdict,
    score,
    findings: deduped,
    meta: {
      engine: `tinfoil-scan/${VERSION}`,
      sigVersion: (sig.meta && sig.meta.version) || 'unknown',
      url,
      host,
      scriptsFetched: scripts.filter((s) => s && s.content).length,
      scriptsListed: scripts.length,
      scannedAt: new Date().toISOString(),
    },
  };
}

function isKnownCdn(sh) {
  return /(^|\.)(cloudflare\.com|cloudfront\.net|jsdelivr\.net|unpkg\.com|googleapis\.com|gstatic\.com|bootstrapcdn\.com|cdnjs\.com|akamaihd\.net|fastly\.net|walletconnect\.(com|org)|vercel\.app|netlify\.app|ipfs\.(io|dweb\.link)|arweave\.net)$/.test(sh);
}

function isLegit(sh, legitList) {
  const n = normalizeDomain(sh);
  return (legitList || []).some((l) => {
    const ln = normalizeDomain(l);
    return n === ln || n.endsWith('.' + ln);
  });
}

function brandMismatch(html, host, legitList) {
  const titleMatch = /<title[^>]*>([^<]{2,120})<\/title>/i.exec(html || '');
  const text = ((titleMatch && titleMatch[1]) || '').toLowerCase();
  const brands = [
    ['uniswap', 'uniswap.org'], ['opensea', 'opensea.io'], ['ledger', 'ledger.com'],
    ['metamask', 'metamask.io'], ['coinbase', 'coinbase.com'], ['blur', 'blur.io'],
    ['zora', 'zora.co'], ['magic eden', 'magiceden.io'], ['tensor', 'tensor.trade'],
    ['jupiter', 'jup.ag'], ['raydium', 'raydium.io'], ['pancakeswap', 'pancakeswap.finance'],
    ['lido', 'lido.fi'], ['aave', 'aave.com'], ['polymarket', 'polymarket.com'],
  ];
  for (const [brand] of brands) {
    if (text.includes(brand) && !normalizeDomain(host).includes(brand.replace(/ /g, ''))) return brand;
  }
  return null;
}

export default { scanPage, VERSION };
