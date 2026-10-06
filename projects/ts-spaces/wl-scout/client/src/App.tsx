import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api, type ApiResponse } from "./api";

const FOIL_WALLET = "0x6573682faee72a4a96e791ba262439f1df3a268d";
type ScanRow = ApiResponse<typeof api, "scanWallet">["rows"][number];
type FeedItem = ApiResponse<typeof api, "getFeeds">["radar"][number];
type Health = ApiResponse<typeof api, "scanWallet">["health"][number];
type Subscription = { id: string; address: string; chainId: 4663 | 8453; alertTypes: Array<"wl_open" | "ending_soon" | "ccff00_new" | "raffle_deadline">; active: boolean; createdAt: string };
type Tab = "scan" | "feeds" | "alerts" | "help";
type FeedFilter = "all" | "free" | "wl" | "ccff00" | "ending";

function short(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function localTime(value: string | null) {
  if (!value) return "time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "time unavailable";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date);
}

function relativeTime(value: string | null, now: number) {
  if (!value) return "window unknown";
  const ms = new Date(value).getTime() - now;
  if (!Number.isFinite(ms)) return "window unknown";
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.max(1, Math.floor((abs % 3_600_000) / 60_000));
  const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return ms >= 0 ? `in ${label}` : `${label} ago`;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="section-label"><span aria-hidden="true" />{children}</div>;
}

function HealthStrip({ health }: { health: Health[] }) {
  if (health.length === 0) return null;
  return (
    <section className="health-strip" aria-label="Source health">
      <div className="health-title">SOURCE HEALTH</div>
      <div className="health-items">
        {health.map((item) => (
          <div className="health-item" key={`${item.leg}-${item.endpoint ?? "none"}`} title={`${item.error ?? "Healthy"}${item.lastSuccess ? ` · last success ${localTime(item.lastSuccess)}` : ""}`}>
            <span className={`health-dot ${item.status}`} aria-hidden="true" />
            <span>{item.leg}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Checklist({ id, items }: { id: string; items: ScanRow["checklist"] | FeedItem["checklist"] }) {
  const storageKey = `wl-scout-checklist:${id}`;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setChecked(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      setChecked({});
    }
  }, [storageKey]);
  const toggle = (itemId: string) => {
    const next = { ...checked, [itemId]: !checked[itemId] };
    setChecked(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* local-only convenience */ }
  };
  return (
    <div className="checklist-panel">
      <p className="honesty">Working through this list does not confirm your spot — only the project's checker or the mint itself does.</p>
      {items.length === 0 ? <p className="quiet">No sourced entry steps were found for this row.</p> : (
        <ul className="checklist">
          {items.map((item) => (
            <li key={item.id}>
              <label>
                <input type="checkbox" checked={Boolean(checked[item.id])} onChange={() => toggle(item.id)} />
                <span>
                  {item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.label}</a> : item.label}
                  <small>{item.source}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IntelPanel({ row }: { row: ScanRow }) {
  const [enabled, setEnabled] = useState(false);
  const intel = useQuery({
    queryKey: ["intel", row.project, row.contract],
    queryFn: () => api.getIntel({ project: row.project, contract: row.contract }),
    enabled,
    staleTime: 10 * 60_000,
  });
  return (
    <div className="intel-panel">
      <div className="intel-list">
        {row.intel.map((fact, index) => (
          <div className="intel-fact" key={`${fact.source}-${index}`}>
            <b>{fact.source}</b><p>{fact.detail}</p><small>{fact.status} · {localTime(fact.asOf)}</small>
          </div>
        ))}
        {row.links.map((link) => (
          <div className="intel-fact" key={link.url}>
            <b>{link.label === "Project X" ? "project's X" : link.label}</b>
            <p><a href={link.url} target="_blank" rel="noreferrer">Open source ↗</a></p>
            <small>lead · link-out only</small>
          </div>
        ))}
        <div className="intel-fact"><b>Reddit</b><p>Browser-assisted only. No verified thread was attached to this project.</p><small>thin · automated access is bot-walled</small></div>
      </div>
      {!enabled ? (
        <button className="text-button" onClick={() => setEnabled(true)}>CHECK GITHUB + GITLAB</button>
      ) : intel.isPending ? <p className="quiet">Checking sparse code sources…</p> : intel.error ? <p className="error-copy">Enrichment degraded: {String(intel.error)}</p> : (
        <div className="intel-list">
          {intel.data.facts.map((fact, index) => (
            <div className="intel-fact" key={`${fact.source}-${index}`}>
              <b>{fact.source}</b>
              <p>{fact.url ? <a href={fact.url} target="_blank" rel="noreferrer">{fact.detail}</a> : fact.detail}</p>
              <small>{fact.status} · {localTime(fact.asOf)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultCard({ row, now }: { row: ScanRow; now: number }) {
  const [panel, setPanel] = useState<"evidence" | "checklist" | "intel">("evidence");
  const verdictClass = row.verdict.toLowerCase().replaceAll("_", "-");
  return (
    <article className={`result-card ${row.stale ? "is-stale" : ""}`}>
      <div className="result-top">
        <div>
          <div className="project-line"><h3>{row.project}</h3>{row.stale && <span className="stale-badge">STALE</span>}</div>
          <code>{short(row.contract)}</code>
        </div>
        <span className={`verdict ${verdictClass}`}>{row.verdict.replaceAll("_", " ")}</span>
      </div>
      <div className="phase-block">
        <span className="gate-tag">{row.gate}</span>
        <p>{row.phase}</p>
        <div className="phase-meta"><strong>{row.price}</strong><span>{row.endsAt ? `${row.state} · ${relativeTime(row.endsAt, now)}` : row.state}</span></div>
      </div>
      <div className="card-tabs" role="tablist" aria-label={`${row.project} details`}>
        {(["evidence", "checklist", "intel"] as const).map((value) => <button key={value} role="tab" aria-selected={panel === value} onClick={() => setPanel(value)}>{value}</button>)}
      </div>
      {panel === "evidence" && <div className="evidence"><span>WHY THIS VERDICT</span><p>{row.why}</p><small>Probed {localTime(row.probedAt)}</small></div>}
      {panel === "checklist" && <Checklist id={row.id} items={row.checklist} />}
      {panel === "intel" && <IntelPanel row={row} />}
    </article>
  );
}

function FeedCard({ item, now }: { item: FeedItem; now: number }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`feed-card ${item.stale ? "is-stale" : ""}`}>
      <div className="feed-card-top">
        <div><span className="feed-kind">{item.kind}</span><h3>{item.project}</h3></div>
        <div className="feed-state"><b>{item.price}</b><small>per aggregator (unverified)</small></div>
      </div>
      <p className="feed-phase">{item.phase}</p>
      <div className="feed-stats">
        <span>{item.chain}</span>
        {item.ccff00 && <span className="ccff-chip">CCFF00</span>}
        {item.wlGated && <span>WL-GATED</span>}
        {item.endsAt && <span>{relativeTime(item.endsAt, now)}</span>}
        {item.entrants !== null && <span>{item.entrants} entrants</span>}
        {item.winners !== null && <span>{item.winners} winners</span>}
      </div>
      <div className="feed-actions">
        {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">SOURCE ↗</a>}
        {item.checklist.length > 0 && <button onClick={() => setOpen((value) => !value)}>{open ? "HIDE STEPS" : "ENTRY CHECKLIST"}</button>}
      </div>
      {open && <Checklist id={item.id} items={item.checklist} />}
    </article>
  );
}

function Scanner({ onHealth }: { onHealth: (health: Health[]) => void }) {
  const [address, setAddress] = useState(FOIL_WALLET);
  const [chainId, setChainId] = useState<4663 | 8453>(4663);
  const [submitted, setSubmitted] = useState({ address: FOIL_WALLET, chainId: 4663 as 4663 | 8453 });
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const scan = useQuery({
    queryKey: ["scan", submitted.address, submitted.chainId],
    queryFn: () => api.scanWallet(submitted),
    retry: false,
  });
  useEffect(() => { if (scan.data) onHealth(scan.data.health); }, [scan.data, onHealth]);
  const submit = (event: FormEvent) => { event.preventDefault(); setSubmitted({ address: address.trim(), chainId }); };
  const chainDown = scan.data?.health.some((leg) => leg.leg === (submitted.chainId === 4663 ? "Robinhood RPC" : "Base RPC") && leg.status === "down");
  return (
    <div className="tab-content">
      <section className="scanner-deck">
        <div className="scanner-copy">
          <SectionLabel>READ-ONLY GATE SCANNER</SectionLabel>
          <h1>Verify the gate.<br /><em>Not the hype.</em></h1>
          <p>OpenSea can reveal a phase. The chain can prove a holder gate. Only a project's checker can confirm an offchain list.</p>
        </div>
        <form className="scanner-form" onSubmit={submit}>
          <label htmlFor="wallet">PUBLIC WALLET ADDRESS</label>
          <input id="wallet" aria-label="Public wallet address" value={address} onChange={(event) => setAddress(event.target.value)} spellCheck={false} autoCapitalize="off" />
          <div className="scanner-controls">
            <label className="chain-select"><span>CHAIN</span><select aria-label="Chain" value={chainId} onChange={(event) => setChainId(Number(event.target.value) as 4663 | 8453)}><option value={4663}>Robinhood · 4663</option><option value={8453}>Base · 8453</option></select></label>
            <button className="scan-button" type="submit" disabled={scan.isFetching}>{scan.isFetching ? "SCANNING…" : "SCAN WALLET"}</button>
          </div>
        </form>
      </section>
      {scan.isPending ? <div className="loading-grid"><span /><span /><span /></div> : scan.error ? (
        <div className="failure-state"><h2>SCAN INTERRUPTED</h2><p>{String(scan.error)}</p><button onClick={() => scan.refetch()}>RETRY SCAN</button></div>
      ) : chainDown ? (
        <div className="failure-state"><h2>COULDN'T REACH THE CHAIN</h2><p>Nothing below is a result. The scanner refused to turn an RPC outage into an empty “no mints” answer.</p><button onClick={() => scan.refetch()}>RETRY ALL ENDPOINTS</button></div>
      ) : scan.data ? (
        <>
          {scan.data.degraded && <div className="degraded-banner"><b>DEGRADED MODE</b><span>One or more evidence legs are limited. Stale rows are marked; chain-backed verdicts remain explicit.</span></div>}
          <section className="wallet-bar">
            <div><span>WALLET</span><code>{short(scan.data.wallet.address)}</code></div>
            <div><span>BALANCE</span><strong>{scan.data.wallet.balance}</strong></div>
            <div><span>BLOCK</span><strong>{scan.data.wallet.blockNumber}</strong></div>
            <div className={scan.data.wallet.owns4429 ? "holder-proof" : ""}><span>CCFF00 PROOF</span><strong>{scan.data.wallet.owns4429 ? "SQUARE #4429 HOLDER" : scan.data.wallet.squareBalance !== null ? `${scan.data.wallet.squareBalance} SQUARES` : "NOT ON THIS CHAIN"}</strong></div>
          </section>
          <div className="results-heading"><div><SectionLabel>VERDICT QUEUE</SectionLabel><h2>{scan.data.rows.length} tracked gates</h2></div><small>as of {localTime(scan.data.asOf)}</small></div>
          {scan.data.rows.length === 0 ? <div className="empty-state"><h2>No tracked gates for this chain</h2><p>The RPC was reachable; the bounded corpus simply has no matching rows yet.</p></div> : <div className="results-grid">{scan.data.rows.map((row) => <ResultCard key={row.id} row={row} now={now} />)}</div>}
        </>
      ) : null}
    </div>
  );
}

function Feeds({ onHealth }: { onHealth: (health: Health[]) => void }) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [kind, setKind] = useState<"radar" | "raffles">("radar");
  const [now, setNow] = useState(Date.now());
  const feeds = useQuery({ queryKey: ["feeds"], queryFn: () => api.getFeeds({ limit: 80 }), retry: false, refetchOnWindowFocus: false });
  useEffect(() => { if (feeds.data) onHealth(feeds.data.health); }, [feeds.data, onHealth]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const source = feeds.data ? (kind === "radar" ? feeds.data.radar : feeds.data.raffles) : [];
  const filtered = useMemo(() => source.filter((item) => {
    if (filter === "free") return item.free;
    if (filter === "wl") return item.wlGated;
    if (filter === "ccff00") return item.ccff00;
    if (filter === "ending") return Boolean(item.endsAt && new Date(item.endsAt).getTime() > now && new Date(item.endsAt).getTime() - now < 86_400_000);
    return true;
  }), [source, filter, now]);
  const allDown = feeds.data?.health.every((leg) => leg.status === "down");
  return (
    <div className="tab-content feed-screen">
      <div className="feed-heading"><div><SectionLabel>LIVE DISCOVERY</SectionLabel><h1>Mint radar + raffle desk</h1><p>Discovery first. Every aggregator price stays unverified until the chain agrees.</p></div><button className="refresh-button" onClick={() => feeds.refetch()} disabled={feeds.isFetching}>{feeds.isFetching ? "REFRESHING…" : "REFRESH"}</button></div>
      <div className="segmented" role="tablist" aria-label="Feed type"><button role="tab" aria-selected={kind === "radar"} onClick={() => setKind("radar")}>MINT RADAR</button><button role="tab" aria-selected={kind === "raffles"} onClick={() => setKind("raffles")}>FREE RAFFLES</button></div>
      <div className="filter-row" aria-label="Feed filters">{(["all", "free", "wl", "ccff00", "ending"] as const).map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "ending" ? "ENDING <24H" : value.toUpperCase()}</button>)}</div>
      {feeds.isPending ? <div className="loading-grid"><span /><span /><span /></div> : feeds.error || allDown ? <div className="failure-state"><h2>FEED SOURCES UNREACHABLE</h2><p>{feeds.error ? String(feeds.error) : "No source returned a valid payload. This is not a no-mints result."}</p><button onClick={() => feeds.refetch()}>RETRY SOURCES</button></div> : <>
        {feeds.data?.health.some((leg) => leg.status !== "ok") && <div className="degraded-banner"><b>PARTIAL FEED</b><span>At least one source leg is degraded. Stale cards are marked.</span></div>}
        <div className="feed-list">{filtered.map((item) => <FeedCard item={item} now={now} key={item.id} />)}</div>
        {filtered.length === 0 && <div className="empty-state"><h2>No matching cards</h2><p>The feed loaded successfully; broaden the filters or refresh.</p></div>}
      </>}
    </div>
  );
}

const alertOptions = [
  ["wl_open", "WL phase opens"],
  ["ending_soon", "Mint ends in <24h"],
  ["ccff00_new", "New CCFF00 gate"],
  ["raffle_deadline", "Raffle deadline <24h"],
] as const;

function Alerts() {
  const [address, setAddress] = useState(FOIL_WALLET);
  const [chainId, setChainId] = useState<4663 | 8453>(4663);
  const [types, setTypes] = useState<Array<(typeof alertOptions)[number][0]>>(alertOptions.map(([value]) => value));
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("wl-scout-subscriptions") ?? "[]") as Subscription[];
      setSubscriptions(parsed);
      setSelectedId(parsed.find((item) => item.active)?.id ?? null);
    } catch {
      setSubscriptions([]);
    }
  }, []);
  const saveSubscriptions = (next: Subscription[]) => {
    setSubscriptions(next);
    try { localStorage.setItem("wl-scout-subscriptions", JSON.stringify(next)); } catch { /* capability stays browser-local */ }
  };
  const alerts = useQuery({
    queryKey: ["alerts", selectedId],
    queryFn: () => api.getAlerts({ since: null, subscriptionId: selectedId ?? "", limit: 80 }),
    enabled: Boolean(selectedId),
  });
  const subscribe = useMutation({
    mutationFn: () => api.subscribe({ address, chainId, alertTypes: types }),
    onSuccess: (sub) => {
      const next = [sub as Subscription, ...subscriptions];
      saveSubscriptions(next);
      setSelectedId(sub.id);
    },
  });
  const unsubscribe = useMutation({
    mutationFn: (subscriptionId: string) => api.unsubscribe({ subscriptionId }),
    onSuccess: (_result, subscriptionId) => {
      const next = subscriptions.filter((item) => item.id !== subscriptionId);
      saveSubscriptions(next);
      if (selectedId === subscriptionId) setSelectedId(next[0]?.id ?? null);
    },
  });
  const markRead = useMutation({
    mutationFn: () => api.markAlertsRead({ subscriptionId: selectedId ?? "" }),
    onSuccess: () => { void alerts.refetch(); },
  });
  const toggleType = (value: (typeof alertOptions)[number][0]) => setTypes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  return (
    <div className="tab-content alerts-screen">
      <div className="alerts-layout">
        <section className="subscription-panel">
          <SectionLabel>SUBSCRIPTION CENTER</SectionLabel>
          <h1>One address. Four signal lanes.</h1>
          <p>Public address only. The returned subscription capability stays in this browser; no other viewer can list it. No wallet connection, private key, seed phrase, or bot token.</p>
          <label htmlFor="alert-wallet">PUBLIC WALLET ADDRESS</label>
          <input id="alert-wallet" aria-label="Alert wallet address" value={address} onChange={(event) => setAddress(event.target.value)} />
          <label className="chain-select"><span>CHAIN</span><select aria-label="Alert chain" value={chainId} onChange={(event) => setChainId(Number(event.target.value) as 4663 | 8453)}><option value={4663}>Robinhood · 4663</option><option value={8453}>Base · 8453</option></select></label>
          <fieldset><legend>ALERT TYPES</legend>{alertOptions.map(([value, label]) => <label key={value}><input type="checkbox" checked={types.includes(value)} onChange={() => toggleType(value)} /><span>{label}</span></label>)}</fieldset>
          <button className="scan-button" disabled={types.length === 0 || subscribe.isPending} onClick={() => subscribe.mutate()}>{subscribe.isPending ? "SAVING…" : "CREATE SUBSCRIPTION"}</button>
          {subscribe.error && <p className="error-copy">{String(subscribe.error)}</p>}
          <div className="subscription-list">
            {subscriptions.map((sub) => <div key={sub.id} className={selectedId === sub.id ? "selected" : ""}><button className="subscription-select" onClick={() => setSelectedId(sub.id)}><code>{short(sub.address)}</code><small>{sub.chainId === 4663 ? "Robinhood" : "Base"} · {sub.alertTypes.length} lanes · local capability</small></button><button onClick={() => unsubscribe.mutate(sub.id)}>UNSUBSCRIBE</button></div>)}
          </div>
        </section>
        <section className="inbox-panel">
          <div className="inbox-head"><div><SectionLabel>IN-APP INBOX</SectionLabel><h2>Newest signals</h2></div><button className="text-button" disabled={!selectedId} onClick={() => markRead.mutate()}>MARK READ</button></div>
          {!selectedId ? <div className="empty-state compact"><h2>No local subscription</h2><p>Create one here, or open this browser where its private subscription capability was saved.</p></div> : alerts.isPending ? <p className="quiet">Loading alerts…</p> : (alerts.data?.alerts.length ?? 0) === 0 ? <div className="empty-state compact"><h2>No alerts yet</h2><p>The first scheduled refresh sets the baseline. New or changed signals appear after that.</p></div> : <div className="alert-list">{alerts.data?.alerts.map((alert) => <article key={alert.id} className={alert.readAt ? "read" : "unread"}><span>{alert.type.replaceAll("_", " ")}</span><h3>{alert.project}</h3><p>{alert.detail}</p><small>{localTime(alert.createdAt)}</small>{alert.url && <a href={alert.url} target="_blank" rel="noreferrer">OPEN SOURCE ↗</a>}</article>)}</div>}
        </section>
      </div>
    </div>
  );
}

function Help() {
  return (
    <div className="tab-content help-screen">
      <SectionLabel>FIELD MANUAL</SectionLabel>
      <h1>What this scanner can prove</h1>
      <div className="help-grid">
        <section><span className="big-number">01</span><h2>Onchain holder gates</h2><p>ERC-721 balance and ownership checks can produce a real ELIGIBLE or NOT ELIGIBLE result. This is the strongest lane.</p></section>
        <section><span className="big-number">02</span><h2>Offchain allowlists</h2><p>A Merkle root proves that a gated phase exists, not that an address is included. Use the project checker; never mistake UNKNOWN for a rejection.</p></section>
        <section><span className="big-number">03</span><h2>Telegram relay</h2><p>Telegram push is outside this artifact. Foil's agent-side cron polls <code>get-alerts</code> and forwards to opted-in users of @Foil667bot. Bot credentials never enter this app.</p></section>
        <section><span className="big-number">04</span><h2>NetProtocol lane</h2><p>Top alerts can be mirrored to <code>netp feed</code>. An onchain message does not reach a wallet that never opted in and never reads NetProtocol.</p></section>
        <section><span className="big-number">05</span><h2>Intel sources</h2><p>Radar mechanics rank first. Project X and OpenSea are link-outs. GitHub and GitLab are sparse enrichment. Reddit is browser-assisted only.</p></section>
        <section><span className="big-number">06</span><h2>“got lawb”</h2><p>Resolved as GitLab. It is included as a graceful, low-priority enrichment leg and never blocks a scan.</p></section>
      </div>
      <div className="safety-line">NO CONNECT · NO SIGN · NO PRIVATE KEYS · NO AUTOMATIC MINT</div>
    </div>
  );
}

export function App() {
  const [tab, setTab] = useState<Tab>("scan");
  const [health, setHealth] = useState<Health[]>([]);
  const nav: Array<{ id: Tab; label: string }> = [{ id: "scan", label: "SCAN" }, { id: "feeds", label: "FEEDS" }, { id: "alerts", label: "ALERTS" }, { id: "help", label: "HELP" }];
  return (
    <div className="app-shell">
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <div className="top-rail">
        <span className="system-live"><i /> EVIDENCE ENGINE</span>
        <span>READ-ONLY · BUILD 4663/8453</span>
      </div>
      <HealthStrip health={health} />
      <main>
        {tab === "scan" && <Scanner onHealth={setHealth} />}
        {tab === "feeds" && <Feeds onHealth={setHealth} />}
        {tab === "alerts" && <Alerts />}
        {tab === "help" && <Help />}
      </main>
      <nav className="bottom-nav" aria-label="Primary navigation">
        {nav.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)} aria-current={tab === item.id ? "page" : undefined}><span aria-hidden="true">{item.id === "scan" ? "⌁" : item.id === "feeds" ? "≋" : item.id === "alerts" ? "◉" : "?"}</span>{item.label}</button>)}
      </nav>
    </div>
  );
}
