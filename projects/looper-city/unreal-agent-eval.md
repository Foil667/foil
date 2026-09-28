# unreal-agent — Zero-Trust Security Audit + Looper City Fit Evaluation

**Date:** 2026-09-23
**Repo:** https://github.com/staccDOTsol/unreal-agent (fork of https://github.com/unreallabsai/unreal-agent)
**Commit audited:** `e0671ef` (fork main; 14 commits ahead of upstream)
**Auditor stance:** zero-trust — every claim verified in code, README treated as marketing.

## Verdict: CONDITIONAL

Adopt the **harness library** (coordinator, session store, tool interfaces) as Looper City's resident-agent runtime — it is genuinely well-architected, heavily tested, and dependency-clean. **Do not** deploy the default runner configuration, do not enable the Bash tool for residents, and do not budget city economics on the "5x cheaper" claim. With sandboxing + a custom minimal toolset + API-token budgeting, it's a GO. As shipped, it's a single-developer agent harness, not a multi-tenant resident runtime.

---

## 1. What it actually is

- Async-first Go agent harness (Unreal Labs upstream). Core loop: **Inbox** (idempotent external/control inputs) → **Coordinator** (LLM turns, crash recovery) → **Tool translators** (pure, no I/O) → **Operation manager** (durable async execution via primitives: process, file, timer, remote/SSE) → **Session store** (append-only JSONL on local disk, forkable, resumable by session ID).
- Default tool surface: `Bash`, `ViewImage`, `SkillUse` (local `SKILL.md` files injected as context).
- LLM providers: OpenAI, OpenRouter, Fireworks, Ollama (local), and `openai-codex` (ChatGPT subscription OAuth token).
- Fork additions (14 commits): `cmd/unreal-agent-chatgpt` (private ChatGPT-app launcher + "savings pill" overlay), leCore-inspired BM25 context recall (`harness/contextbuilder/lecore.go`), process-primitive platform refactor, release/publish CI.

---

## 2. Security findings (ordered by severity)

### 🔴 CRITICAL — Bash tool: arbitrary command execution as host user, zero sandboxing

- `harness/tool/bash/bash.go` validates arguments then builds a shell operation; `harness/operation/shell.go` `startShellProcess` runs `shell -c <command>` via the process primitive.
- `harness/primitives/process_unix.go:21` — the **only** process isolation is `SysProcAttr{Setpgid: true}` (process-group for kill signaling). No chroot, no namespaces, no seccomp, no UID/GID drop, no capability restrictions.
- Bash is **enabled by default** in the runner (`cmd/internal/agentrunner/run.go:327-333`), working directory = workspace, shell = `$SHELL` or `/bin/sh`.
- A resident agent can read `~/.bankr/config.json` (API credentials), `~/.ssh/`, `~/.codex/auth.json` (ChatGPT token), exfiltrate over the network, fork-bomb, or persist malware. In a multi-resident city this is a total compromise primitive.
- **Required:** never enable Bash for residents, or run each resident in a real sandbox (gVisor / Firecracker / Docker with seccomp profile, read-only rootfs, egress limited to the game server).

### 🔴 HIGH — System prompt falsely claims sandboxing

- `cmd/internal/agentrunner/run.go:41`: `defaultSystemPrompt = "You are an AI agent running inside an isolated sandbox container."`
- There is no container in the default execution path. The model is told it is sandboxed when it is not — it will take risks (destructive commands, credential handling) premised on a false safety boundary. This is a prompt-level safety deception, whether intentional or sloppy.

### 🔴 HIGH — The "5–6x cheaper" cost claim is subscription arbitrage, not engineering

Verified mechanism (see §3). The harness routes traffic through a **consumer ChatGPT Plus subscription OAuth token** instead of pay-per-token API billing:
- `cmd/unreal-agent-chatgpt/launch.go` downloads the real ChatGPT desktop app from `https://persistent.oaistatic.com/codex-app-prod` into a private copy and launches it with a separate `CODEX_HOME`.
- `cmd/unreal-agent-chatgpt/bill.go` + `harness/llm/clients/openaicodex/credentials.go` pick up the subscription token (`~/.codex/auth.json`, chmod-600 enforced — good) and call `https://chatgpt.com/backend-api/codex`.
- `cmd/unreal-agent-chatgpt/pill.go` renders "Saved $X · Y%" by comparing against **OpenRouter list prices** (fetched live from `https://openrouter.ai/api/v1/models`), which include reseller markup — flattering the comparison.
- Problems: (a) likely against OpenAI's ToS for programmatic agent fleets; OpenAI can revoke the pattern at any time; (b) Plus has usage caps — it does not scale to a city of residents; (c) the numbers are inconsistent (repo README: "70–80% cheaper… 5x"; openzoo.fun: "84.5%… 6.5x"). **Do not put this in city economics.**

### 🟠 MEDIUM — Implicit subscription-credential pickup + Bash = token theft chain

- `harness/llm/clients/openaicodex/credentials.go:56-78` (`EnvironmentConfig`): if `OPENAI_CODEX_*` env vars are unset, the harness **silently defaults to `~/.codex/auth.json`** — the user's real ChatGPT login token, not just the launcher's private copy.
- Combined with the unsandboxed Bash tool, any agent can `cat ~/.codex/auth.json` and exfiltrate the subscription token. Even without Bash, the credential is loaded into the agent process implicitly rather than by explicit operator consent per-run.

### 🟠 MEDIUM — ViewImage has no path confinement

- `harness/tool/viewimage/viewimage.go:56-59`: relative paths are joined to the workspace, but **absolute paths bypass it entirely** and `..` segments are deliberately preserved ("filepath.Join would clean it"). The model can view any image file the OS user can read. Lower blast radius than Bash, but a defense-in-depth failure — confine to an asset directory.

### 🟡 LOW — Skill content is a prompt-injection surface (by design)

- `harness/tool/registry.go` `DiscoverSkills`: skills come only from local `<workspace>/.harness/skills/*/SKILL.md` — **no remote fetch, no auto-update** (verified; good). But skill bodies are injected verbatim into model context, so anyone who can drop a file in that directory owns the agent's instructions. In a city: residents must never share a writable skill directory; skills ship with the build, signed/pinned.

### 🟡 LOW — Session store is plaintext JSONL on disk

- `harness/sessionstore/localfile/`: full conversation history persisted per session under `.harness/sessions` (dirs created `0o700` — good). No encryption at rest; if a model ever echoes an API key or wallet material into chat, it lands in plaintext. Scrub secrets from transcripts or encrypt the store volume.

### 🟡 LOW — Installer download: macOS verifies codesign, Windows/Linux do not

- `cmd/unreal-agent-chatgpt/launch.go`: macOS path runs `codesign --verify --deep --strict` and requires the Codex-app bundle (not "ChatGPT Classic"). Windows (`Add-AppxPackage` from downloaded `.msix`) and Linux (`dpkg-deb -x` of downloaded `.deb`) perform **no signature/hash verification** — a compromised CDN or DNS gives arbitrary code execution at install time. (CDN is `persistent.oaistatic.com`, legitimate OpenAI infra, but hardcoded with no pinning.)

### ✅ CLEAR — Supply chain

- `go.mod`: only `oapi-codegen/runtime`, `golang.org/x/image`, `golang.org/x/sys`, `go-jsonmerge`, `google/uuid`. Minimal, reputable, no sketchy transitive deps. Fork retains upstream module path (`github.com/unreallabsai/unreal-agent`) — no dependency-confusion play.
- 14 fork commits reviewed individually: ChatGPT launcher, savings pill, leCore recall, process-platform refactor, publish CI. **No exfiltration, no obfuscation, no hidden network calls.** The process refactor preserved the `O_NOFOLLOW` symlink protection on capture files (`harness/primitives/process_unix.go:30`).

### ✅ CLEAR — Network surface / telemetry

- Outbound calls found (all legitimate, none telemetry): configured LLM provider endpoints (`api.openai.com`, `openrouter.ai`, `api.fireworks.ai`, `localhost:11434` for Ollama, `chatgpt.com/backend-api/codex`); OpenRouter price-catalog fetch (pill UI only, `pill.go:379`); ChatGPT installer CDN download (launcher only). **No analytics, no phone-home, no update checks.** No listening sockets in the harness or runner (remote SSE/SSE primitives are *clients* for opt-in remote job dispatch).
- **No wallet, private-key, signing, or crypto code anywhere** in the repo (grepped). Nothing in the harness can touch an EVM wallet by itself.

### ✅ CLEAR — Secrets handling in code

- API keys flow via env vars (`UNREAL_HARNESS_LLM_API_KEY`, provider-specific) into `Authorization` headers; no key material found in log paths. Auth-file reader enforces `chmod 600` (`credentials.go:readAuthFile`).

---

## 3. Cost-claim verification: what "5x cheaper" really is

| Claimed mechanism | In code? | Assessment |
|---|---|---|
| Harness makes frontier models 5–6x cheaper | ❌ No | The harness has no model-routing, batching, or caching discount. The 5x is **subscription arbitrage** (Plus token vs API list price). |
| BM25 local recall cuts context | ✅ Yes | `harness/contextbuilder/lecore.go`: when context exceeds 16k chars, older turns are BM25-ranked and only the top ~16k chars are resent, with an omission report. Genuine input-token savings on long sessions (roughly tens of percent, not 5x). |
| Content-addressed dedup of repeated reads | ✅ Yes | `harness/contextbuilder/bind.go`: identical tool-result bytes hashed (SHA-256), bound once, later reads reference provenance. Small, real saving. |
| Savings pill | ✅ Yes | `cmd/unreal-agent-chatgpt/pill.go`: honest arithmetic **against a flattering baseline** (OpenRouter list). Marketing, not measurement of harness efficiency. |

**Bottom line:** real but modest token optimizations in the harness; the headline number is not a property of the software and does not transfer to Looper City scale.

---

## 4. Fit assessment for Looper City

| Requirement | Fit | Notes |
|---|---|---|
| Long-lived resident state | ✅ Strong | File-based sessions, resume by `session_id`, **fork support**, crash recovery, append-only history. Residents can persist across restarts. |
| Concurrent residents | ⚠️ Partial | One process = one agent run; sessions are per-ID files (no cross-session locking issues observed). But **no built-in multi-agent orchestration, no agent-to-agent messaging, no shared world-state primitive**. City needs an external supervisor to spawn/schedule N residents and route game ticks. |
| Receiving game events (ticks, chat, proximity) | ✅ Good | Inbox accepts external inputs with caller-supplied IDs and dedup — a clean injection point for "tick 4521: you are at (x,y), Quinn says hi". |
| Custom toolset (move, say, look, inventory, buy plot) | ✅ Good | `tool.Translator` interface is small and pure (validate → submit operation spec). Writing city tools in Go is straightforward; operations are versioned/serializable. |
| Moderation / sheriff mechanism (SPEC §5) | ❌ Missing | No policy engine, no tool-call approval hooks in the default path (translators run unconditionally). Would need a wrapper: custom registry that gates tool calls against city rules. |
| Cost at city scale | ❌ As-marketed | Subscription path doesn't scale; real cost = API tokens per resident per tick. The lecore recall helps cap context; still needs a per-tick token budget and idle-sleep design. |
| Wallet interaction for residents | ➖ None | Harness has no crypto capability — which is a *safety plus*. Any plot-purchase flow must be built as a city tool with server-side signing, never by giving residents keys. |

**Fit summary:** the architecture (durable async operations, session persistence/forking, clean tool interfaces, idempotent inbox) is a genuinely good foundation for resident agents — better than bolting an agent loop onto a game server from scratch. The gaps are all on the deployment/ops side: sandboxing, supervision, moderation hooks, and honest cost budgeting. None are disqualifying; all require real work.

---

## 5. Hardening steps (required if adopted)

1. **Sandbox every resident.** No Bash for residents, ever — or run each resident process in gVisor/Firecracker/Docker with a seccomp profile, read-only rootfs, no network except the game server. The Dockerfile's `USER 10001` is a start, not a sandbox.
2. **Ship a city-specific toolset as the only tools.** Implement `Move`, `Say`, `Look`, `Emote`, (server-mediated) `BuyPlot` etc. as translators; disable `Bash` and confine or disable `ViewImage`. Registry supports an explicit enabled-set — use it.
3. **Fix the system prompt.** Delete the "isolated sandbox container" lie; write a least-privilege city prompt (identity, rules, tool boundaries, no credential handling).
4. **Budget real API costs.** Use a standard provider with per-key spend caps; set per-resident per-tick token budgets; sleep idle residents instead of polling; keep the lecore recall enabled to cap context growth.
5. **Do not use the `openai-codex` provider or the ChatGPT launcher for the city.** Subscription arbitrage is a ToS risk and a single point of revocation; the implicit `~/.codex/auth.json` pickup is a credential-management smell.
6. **Moderation layer.** Wrap the tool registry with a city-rules gate (rate limits, forbidden actions, sheriff kill-switch per SPEC §5) before Phase 3 autonomous residency.
7. **Session-store hygiene.** Encrypt the session volume or isolate it per resident; scrub anything secret-like from stored transcripts; treat session files as sensitive.
8. **Pin the build.** `go build -trimpath`, verify `go.sum`, build from a pinned commit; do not run the fork's prebuilt installers on city infra. If the launcher is ever used, add hash verification for the Windows/Linux installer paths.

---

## Appendix: key file references

- Unsandboxed exec: `harness/operation/shell.go` (`startShellProcess`), `harness/primitives/process_unix.go:21`
- Bash default-on: `cmd/internal/agentrunner/run.go:327-333`; sandbox lie: same file `:41`
- Skill discovery (local only): `harness/tool/registry.go` (`DiscoverSkills`)
- ViewImage path handling: `harness/tool/viewimage/viewimage.go:56-59`
- Codex credential pickup: `harness/llm/clients/openaicodex/credentials.go:56-78`; billing: `cmd/unreal-agent-chatgpt/bill.go`
- Installer CDN + download: `cmd/unreal-agent-chatgpt/launch.go:17`, `httpDownload`
- Savings pill math: `cmd/unreal-agent-chatgpt/pill.go` (`priceCall`, `fetchOpenRouterCatalog`)
- Context recall: `harness/contextbuilder/lecore.go` (`recallLocal`); dedup: `harness/contextbuilder/bind.go`
- Session store: `harness/sessionstore/localfile/store.go`; sessions dir default `.harness/sessions`
- Tool interface for city tools: `harness/tool/tool.go` (`Translator`)
- Inbox (game-tick injection point): `harness/inbox/inbox.go`, `harness/inbox/local.go`
