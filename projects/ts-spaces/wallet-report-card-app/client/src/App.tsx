import { useMemo, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api, type ApiResponse } from "./api";

type Analysis = ApiResponse<typeof api, "analyzeWallet">;
type SuccessAnalysis = Extract<Analysis, { status: "ok" }>;
type Chain = "base" | "ethereum" | "robinhood";

const CHAINS: { value: Chain; label: string; note: string }[] = [
  { value: "base", label: "Base", note: "Blockscout" },
  { value: "ethereum", label: "Ethereum", note: "Blockscout" },
  { value: "robinhood", label: "Robinhood Chain", note: "Explorer + RPC fallback" },
];

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatDuration(days: number | null): string {
  if (days === null) return "No exits yet";
  if (days < 1) return `${Math.max(1, Math.round(days * 24))} hr`;
  if (days < 60) return `${days.toLocaleString(undefined, { maximumFractionDigits: 1 })} days`;
  if (days < 730) return `${(days / 30.4375).toLocaleString(undefined, { maximumFractionDigits: 1 })} months`;
  return `${(days / 365.25).toLocaleString(undefined, { maximumFractionDigits: 1 })} years`;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="metric-row">
      <div>
        <p className="metric-label">{label}</p>
        <p className="metric-note">{note}</p>
      </div>
      <strong className="metric-value">{value}</strong>
    </div>
  );
}

function FormulaBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="formula-row">
      <div className="formula-row-head">
        <span>{label}</span>
        <strong>{value.toFixed(1)} / {max}</strong>
      </div>
      <div className="formula-track" aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function Report({ report }: { report: SuccessAnalysis }) {
  const [copied, setCopied] = useState(false);
  const longestName = report.metrics.longestHeld.collectionName ?? shortAddress(report.metrics.longestHeld.contract);

  async function copyReceipt() {
    try {
      await navigator.clipboard.writeText(report.receipt);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = report.receipt;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="report-shell" aria-labelledby="report-rating">
      <div className="score-panel">
        <div
          className="score-stamp"
          style={{ "--score-angle": `${report.score * 3.6}deg` } as React.CSSProperties}
          aria-label={`Score ${report.score} out of 100`}
        >
          <div className="score-core">
            <strong>{report.score}</strong>
            <span>/100</span>
          </div>
        </div>
        <div className="score-copy">
          <p className="mono-kicker">{report.chainLabel} / {shortAddress(report.address)}</p>
          <h2 id="report-rating">{report.rating}</h2>
          <p>Scored from {report.metrics.acquisitionCycles.toLocaleString()} acquisition cycles across {report.metrics.totalDistinctNfts.toLocaleString()} distinct NFTs.</p>
        </div>
      </div>

      <div className="report-grid">
        <div className="metrics-sheet">
          <div className="section-heading">
            <span>Holding behavior</span>
            <span>RESULT</span>
          </div>
          <Metric label="Average hold" value={formatDuration(report.metrics.averageHoldDays)} note="Includes NFTs still held" />
          <Metric label="Flipped within 7 days" value={`${report.metrics.flip7Percent}%`} note={`${report.metrics.flip7EligibleCycles.toLocaleString()} cycles with a known 7-day outcome`} />
          <Metric label="Flipped within 30 days" value={`${report.metrics.flip30Percent}%`} note={`${report.metrics.flip30EligibleCycles.toLocaleString()} cycles with a known 30-day outcome`} />
          <Metric label="Average time to sell*" value={formatDuration(report.metrics.averageTimeToSellDays)} note={`${report.metrics.soldCycles.toLocaleString()} matched outbound transfers`} />
          <Metric label="NFTs ever held" value={report.metrics.totalDistinctNfts.toLocaleString()} note="Distinct contract + token ID pairs" />
          <Metric label="Current holdings" value={report.metrics.currentHoldings.toLocaleString()} note="Open holding cycles" />

          <div className="longest-hold">
            <p className="metric-label">Longest hold</p>
            <strong>{formatDuration(report.metrics.longestHeld.durationDays)}</strong>
            <p>{longestName} #{report.metrics.longestHeld.tokenId}{report.metrics.longestHeld.ongoing ? " · still held" : ""}</p>
          </div>
        </div>

        <div className="method-sheet">
          <div className="section-heading">
            <span>Score anatomy</span>
            <span>{report.score} PTS</span>
          </div>
          <FormulaBar label="Hold duration" value={report.formula.holdPoints} max={50} />
          <FormulaBar label="7-day discipline" value={report.formula.sevenDayPoints} max={30} />
          <FormulaBar label="30-day discipline" value={report.formula.thirtyDayPoints} max={20} />
          <details>
            <summary>Show the exact formula</summary>
            <code>{report.formula.explanation}</code>
            <p>80–100 Diamond Hands · 60–79 Steady Holder · 35–59 Active Flipper · 0–34 Paper Hands. A score waits until at least one acquisition has a known 30-day outcome.</p>
          </details>
          <p className="method-note">*A transfer feed cannot prove a sale. “Flip” and “time to sell” use the first outbound transfer after acquisition as a transparent proxy; gifts and wallet moves can affect the result.</p>
        </div>
      </div>

      <div className="receipt-block">
        <div className="section-heading">
          <span>X-ready receipt</span>
          <span>PLAIN TEXT</span>
        </div>
        <pre>{report.receipt}</pre>
        <button className="copy-button" type="button" onClick={copyReceipt} aria-label="Copy X-ready receipt">
          {copied ? "Copied" : "Copy receipt"}
        </button>
      </div>

      <div className="report-footer">
        <span>Source: {report.source}</span>
        <span>Checked {formatTimestamp(report.analyzedAt)}</span>
      </div>
    </section>
  );
}

export function App() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<Chain>("base");
  const [submittedAddress, setSubmittedAddress] = useState("");

  const validation = useMemo(() => {
    if (!address.trim()) return "";
    return /^0x[0-9a-fA-F]{40}$/.test(address.trim()) ? "" : "Use a 42-character 0x wallet address.";
  }, [address]);

  const analysis = useMutation({
    mutationFn: (request: { address: string; chain: Chain }) => api.analyzeWallet(request),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = address.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(clean)) return;
    setSubmittedAddress(clean);
    analysis.mutate({ address: clean, chain });
  }

  return (
    <div className="app-shell">
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <main>
        <section className="intro-grid">
          <div className="intro-copy">
            <p className="mono-kicker">ERC-721 HOLDING ANALYSIS</p>
            <h1>How strong are those hands?</h1>
            <p className="intro-deck">Trace a wallet’s NFT exits, hold times, and flip patterns—then turn the history into one inspectable score.</p>
          </div>

          <form className="scan-form" onSubmit={submit}>
            <div className="field-group">
              <label htmlFor="wallet-address">Wallet address</label>
              <input
                id="wallet-address"
                name="wallet-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="0x…"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-describedby={validation ? "wallet-error" : "wallet-hint"}
                aria-invalid={Boolean(validation)}
              />
              <span id={validation ? "wallet-error" : "wallet-hint"} className={validation ? "field-error" : "field-hint"}>
                {validation || "Any public EVM wallet. Nothing is connected or signed."}
              </span>
            </div>

            <div className="field-group">
              <label htmlFor="chain-select">Chain</label>
              <select id="chain-select" value={chain} onChange={(event) => setChain(event.target.value as Chain)}>
                {CHAINS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label} — {item.note}</option>
                ))}
              </select>
            </div>

            <button className="scan-button" type="submit" disabled={analysis.isPending || !address.trim() || Boolean(validation)}>
              {analysis.isPending ? "Reading chain…" : "Grade this wallet"}
            </button>
          </form>
        </section>

        {analysis.isPending && (
          <section className="status-panel" role="status" aria-live="polite">
            <span className="scan-pulse" aria-hidden="true" />
            <div>
              <strong>Building the full transfer timeline</strong>
              <p>Older wallets can take longer because every page must be complete before a score is issued.</p>
            </div>
          </section>
        )}

        {analysis.isError && (
          <section className="error-panel" role="alert">
            <p className="mono-kicker">SCAN FAILED</p>
            <h2>The report could not be calculated.</h2>
            <p>{analysis.error instanceof Error ? analysis.error.message : "The request did not complete."}</p>
            <button type="button" onClick={() => analysis.mutate({ address: submittedAddress, chain })}>Try again</button>
          </section>
        )}

        {analysis.data?.status === "error" && (
          <section className="error-panel" role="alert">
            <p className="mono-kicker">NO SCORE ISSUED</p>
            <h2>{analysis.data.code === "HISTORY_TOO_LARGE" ? "History exceeds the safe scan limit." : "Chain data is unavailable."}</h2>
            <p>{analysis.data.message}</p>
            <div className="error-meta">{analysis.data.source} · {formatTimestamp(analysis.data.analyzedAt)}</div>
            <button type="button" onClick={() => {
              const current = analysis.data;
              if (current?.status === "error") analysis.mutate({ address: current.address, chain: current.chain });
            }}>Retry live scan</button>
          </section>
        )}

        {analysis.data?.status === "no_history" && (
          <section className="empty-panel" role="status">
            <div className="empty-mark">Ø</div>
            <div>
              <p className="mono-kicker">NO HISTORY</p>
              <h2>No grade to give.</h2>
              <p>{analysis.data.message}</p>
              <div className="error-meta">{analysis.data.chainLabel} · {shortAddress(analysis.data.address)} · {formatTimestamp(analysis.data.analyzedAt)}</div>
            </div>
          </section>
        )}

        {analysis.data?.status === "insufficient_history" && (
          <section className="empty-panel" role="status">
            <div className="empty-mark">…</div>
            <div>
              <p className="mono-kicker">EARLY READ</p>
              <h2>Not enough history to grade.</h2>
              <p>{analysis.data.message}</p>
              <div className="early-facts">
                <span>{analysis.data.acquisitionCycles.toLocaleString()} acquisition{analysis.data.acquisitionCycles === 1 ? "" : "s"}</span>
                <span>{analysis.data.currentHoldings.toLocaleString()} held now</span>
                <span>Oldest hold {formatDuration(analysis.data.oldestHoldDays)}</span>
              </div>
              <div className="error-meta">First possible 30-day read in about {analysis.data.daysUntilEligible} day{analysis.data.daysUntilEligible === 1 ? "" : "s"} · {analysis.data.source}</div>
            </div>
          </section>
        )}

        {analysis.data?.status === "ok" && <Report report={analysis.data} />}

        {!analysis.data && !analysis.isPending && !analysis.isError && (
          <section className="primer" aria-label="How the rating works">
            <div>
              <span className="primer-number">50</span>
              <p>points for average hold duration</p>
            </div>
            <div>
              <span className="primer-number">30</span>
              <p>points for avoiding 7-day flips</p>
            </div>
            <div>
              <span className="primer-number">20</span>
              <p>points for avoiding 30-day flips</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
