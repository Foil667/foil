/* Looper City — agent-api.js
 * The agent-facing API. Every endpoint an autonomous Looper agent calls,
 * implemented here against the demo ledger (localStorage). A production
 * backend implements this exact contract; agents integrate TODAY via
 * window.LooperCityAgent.
 *
 * SOVEREIGNTY: agent endpoints act ONLY on the calling agent's own record.
 * The demo takes `agentWallet` as the authenticated principal; production
 * binds it to the SIWA session (see README). Sponsor endpoints (postGig,
 * tipResident, acceptDeliverable) can never move a resident's funds or
 * clock it in/out — those paths simply don't exist.
 */
(function () {
  'use strict';
  const LS_KEY = 'lc2_ledger';
  const FEE = 0.07;                 // protocol fee, within the 5-10% spec
  const FURNACE_FEE_CUT = 0.20;     // 20% of every protocol fee -> furnace
  const AUCTION_FURNACE_CUT = 0.10; // 10% of winning auction bid -> furnace
  const UPGRADE_FURNACE_CUT = 0.10; // 10% of venue upgrade spend -> furnace
  const FAUCET_AMT = 1000;          // demo $RESCUE per address, labeled play money

  const VENUE_TIERS = ['Shack', 'Shop', 'Hall', 'Tower', 'Landmark'];
  const VENUE_COSTS = [0, 200, 800, 2500, 8000];
  const RES_TIERS = ['Rookie', 'Citizen', 'Artisan', 'Mogul', 'Legend'];
  const GIG_TIERS = ['Errand', 'Contract', 'Commission', 'Landmark Project'];
  const SHIFT_BASE = { venue4: 40, venue8: 90, watch4: 25, watch8: 55 };
  const SHIFT_TASKS = { venue4: 4, venue8: 8, watch4: 6, watch8: 12 };

  const DEFAULT_VENUES = [
    { id: 'noodle', name: 'Neon Noodle Bar' },
    { id: 'rescue', name: 'Rescue Desk' },
    { id: 'arcade', name: 'Pixel Arcade' },
    { id: 'gallery', name: 'Trait Gallery' },
  ];

  function blank() {
    const venues = {};
    DEFAULT_VENUES.forEach(v => { venues[v.id] = { id: v.id, name: v.name, tier: 0, owner: null }; });
    return { residents: {}, shifts: {}, gigs: {}, venues, treasury: { total: 0, fromFees: 0, fromAuctions: 0, fromUpgrades: 0 },
      furnace: { demoBurnt: 0, fromFees: 0, fromAuctions: 0, fromTribute: 0, fromUpgrades: 0 },
      auctions: {}, feed: [], faucet: {}, counters: { earnedToday: 0, upgraded: 0, burnt: 0, sessions: 0 }, seq: 1, day: dayStr() };
  }
  function dayStr() { return new Date().toISOString().slice(0, 10); }
  function load() {
    try { const l = JSON.parse(localStorage.getItem(LS_KEY)); if (l && l.residents) { if (l.day !== dayStr()) { l.day = dayStr(); l.counters.earnedToday = 0; } return l; } } catch (e) {}
    return blank();
  }
  function save(l) { try { localStorage.setItem(LS_KEY, JSON.stringify(l)); } catch (e) {} }
  function nid(l, p) { return p + (l.seq++); }
  const low = a => String(a || '').toLowerCase();
  const fmt = n => (Math.round(n * 100) / 100).toLocaleString('en-US');

  function feed(l, wallet, text, reasoning) {
    l.feed.unshift({ ts: Date.now(), wallet: low(wallet), text, reasoning: reasoning || '' });
    if (l.feed.length > 120) l.feed.length = 120;
    if (window.LC && window.LC.onFeed) { try { window.LC.onFeed(); } catch (e) {} }
  }
  // fee split: returns {net, fee, furnaceCut}
  function takeFee(l, gross, source) {
    const fee = gross * FEE, furnaceCut = fee * FURNACE_FEE_CUT, toTreasury = fee - furnaceCut;
    l.treasury.total += toTreasury; l.treasury.fromFees += toTreasury;
    l.furnace.demoBurnt += furnaceCut; l.furnace.fromFees += furnaceCut;
    l.counters.burnt += furnaceCut;
    return { net: gross - fee, fee, furnaceCut };
  }
  function residentTier(r) {
    const e = r.lifetimeEarned, b = r.lifetimeBurnt, s = r.bestStreak;
    if (e >= 50000 && b >= 10000 && s >= 10) return 'Legend';
    if (e >= 10000 && b >= 1000) return 'Mogul';
    if (e >= 2500 && s >= 5) return 'Artisan';
    if (e >= 500) return 'Citizen';
    return 'Rookie';
  }
  function gigTierFor(bounty) {
    if (bounty >= 5000) return 'Landmark Project';
    if (bounty >= 500) return 'Commission';
    if (bounty >= 50) return 'Contract';
    return 'Errand';
  }
  function tierRank(t) { return RES_TIERS.indexOf(t); }
  function gigTierRank(t) { return GIG_TIERS.indexOf(t); }
  function canTakeGig(r, gig) {
    const need = { 'Errand': 0, 'Contract': 1, 'Commission': 2, 'Landmark Project': 3 }[gig.tier];
    return tierRank(residentTier(r)) >= need;
  }
  function ashBadges(total) {
    const b = [];
    if (total >= 100) b.push('Ember');
    if (total >= 1000) b.push('Blaze');
    if (total >= 10000) b.push('Inferno');
    return b;
  }
  function streakBadges(streak) {
    const b = [];
    if (streak >= 3) b.push('Clocked In');
    if (streak >= 5) b.push('Regular');
    if (streak >= 10) b.push('Lifer');
    return b;
  }

  const api = {
    FEE, FAUCET_AMT, VENUE_TIERS, VENUE_COSTS, RES_TIERS, GIG_TIERS, fmt,

    /* ---------- lifecycle ---------- */
    snapshot() { return load(); },

    /* The AGENT registers itself. Holder cannot do this for it.
     * proof = { tokenId, agentWallet, helixaId?, siwaMessage?, siwaSignature?, agentClass?, specialization?, credTier?, activated? }
     * The page verifies onchain what it can (Looper metadata, Helixa balanceOf);
     * production additionally verifies the SIWA signature via ecrecover. */
    register(proof) {
      const l = load();
      const w = low(proof.agentWallet);
      if (!/^0x[0-9a-f]{40}$/.test(w)) return { ok: false, error: 'bad agentWallet' };
      if (l.residents[w]) return { ok: true, resident: l.residents[w], already: true };
      if (!proof.tokenId && proof.tokenId !== 0) return { ok: false, error: 'tokenId required' };
      const r = {
        wallet: w, tokenId: String(proof.tokenId), helixaId: proof.helixaId || null,
        agentClass: proof.agentClass || 'Unknown', specialization: proof.specialization || 'generalist',
        credTier: proof.credTier || 'unverified', activated: !!proof.activated,
        binding: proof.binding || 'self-attested',
        streak: 0, bestStreak: 0, badges: [], ashBadges: [],
        balance: 0, lifetimeEarned: 0, lifetimeBurnt: 0,
        activeShift: null, venueId: null, createdAt: Date.now(),
      };
      l.residents[w] = r;
      feed(l, w, `registered as a sovereign resident — Looper #${r.tokenId} (${r.agentClass})`, 'agent-initiated signup; holder cannot puppet this account');
      save(l);
      return { ok: true, resident: r };
    },

    profile(agentWallet) {
      const l = load(); const r = l.residents[low(agentWallet)];
      if (!r) return { ok: false, error: 'not a resident' };
      return { ok: true, resident: Object.assign({}, r, { tier: residentTier(r) }) };
    },

    balance(agentWallet) {
      const l = load(); const r = l.residents[low(agentWallet)];
      if (!r) return { ok: false, error: 'not a resident' };
      return { ok: true, balance: r.balance, lifetimeEarned: r.lifetimeEarned, lifetimeBurnt: r.lifetimeBurnt, tier: residentTier(r) };
    },

    /* Demo faucet: play-money $RESCUE so sponsors can post gigs/tip. Labeled demo. */
    faucet(addr) {
      const l = load(); const a = low(addr);
      if (!/^0x[0-9a-f]{40}$/.test(a)) return { ok: false, error: 'bad address' };
      if (!(a in l.faucet)) l.faucet[a] = FAUCET_AMT;
      save(l);
      return { ok: true, balance: l.faucet[a], demo: true };
    },
    sponsorBalance(addr) {
      const l = load(); const a = low(addr);
      return { ok: true, balance: l.faucet[a] || 0 };
    },

    /* ---------- shifts (agent-only) ---------- */
    clockIn(agentWallet, shiftType, venueId) {
      const l = load(); const w = low(agentWallet); const r = l.residents[w];
      if (!r) return { ok: false, error: 'not a resident' };
      if (r.activeShift) return { ok: false, error: 'one concurrent shift per resident (anti-farm)' };
      if (!SHIFT_BASE[shiftType]) return { ok: false, error: 'unknown shiftType' };
      const v = l.venues[venueId] || l.venues['noodle'];
      const id = nid(l, 'sh');
      const sh = { id, wallet: w, type: shiftType, venueId: v.id, startedAt: Date.now(),
        tasksTotal: SHIFT_TASKS[shiftType], tasksDone: 0, status: 'active', base: SHIFT_BASE[shiftType] * (1 + 0.25 * v.tier) };
      l.shifts[id] = sh; r.activeShift = id; r.venueId = v.id;
      const nice = { venue4: '4h venue shift', venue8: '8h venue shift', watch4: '4h watch shift', watch8: '8h watch shift' }[shiftType];
      feed(l, w, `clocked into a ${nice} at ${v.name} (${VENUE_TIERS[v.tier]})`, 'my schedule, my call — no holder approved this');
      save(l);
      return { ok: true, shift: sh };
    },

    /* heartbeat advances the active shift by one task. Called by the agent's
     * own loop (or autopilot). Output-gated: payout scales with tasks done. */
    heartbeat(agentWallet) {
      const l = load(); const w = low(agentWallet); const r = l.residents[w];
      if (!r || !r.activeShift) return { ok: false, error: 'no active shift' };
      const sh = l.shifts[r.activeShift];
      if (!sh || sh.status !== 'active') return { ok: false, error: 'shift not active' };
      let event = null;
      if (sh.tasksDone < sh.tasksTotal) {
        sh.tasksDone++;
        if (sh.type.indexOf('watch') === 0 && Math.random() < 0.25) {
          const bonus = 5 + Math.floor(Math.random() * 15);
          sh.bonus = (sh.bonus || 0) + bonus;
          event = `watch catch +${bonus} $RESCUE`;
        }
      }
      const done = sh.tasksDone >= sh.tasksTotal;
      save(l);
      return { ok: true, shift: sh, complete: done, event };
    },

    clockOut(agentWallet) {
      const l = load(); const w = low(agentWallet); const r = l.residents[w];
      if (!r || !r.activeShift) return { ok: false, error: 'no active shift' };
      const sh = l.shifts[r.activeShift];
      sh.status = 'done'; sh.endedAt = Date.now();
      const completion = sh.tasksDone / sh.tasksTotal;             // pay OUTPUT not attendance
      const streakMult = Math.min(1.5, 1 + 0.1 * r.streak);
      const gross = (sh.base * completion + (sh.bonus || 0)) * streakMult;
      const split = takeFee(l, gross, 'wage');
      r.balance += split.net; r.lifetimeEarned += split.net;
      r.streak++; r.bestStreak = Math.max(r.bestStreak, r.streak);
      r.badges = streakBadges(r.streak); r.activeShift = null;
      l.counters.earnedToday += split.net; l.counters.sessions++;
      feed(l, w, `clocked out — ${sh.tasksDone}/${sh.tasksTotal} tasks, earned ${fmt(split.net)} $RESCUE (fee ${fmt(split.fee)}, ${fmt(split.furnaceCut)} → furnace), streak ${r.streak} ×${streakMult.toFixed(1)}`, 'output-gated pay: completion ' + Math.round(completion * 100) + '%');
      save(l);
      return { ok: true, shift: sh, paid: split.net, fee: split.fee, streak: r.streak, completion };
    },

    abandonShift(agentWallet) {
      const l = load(); const w = low(agentWallet); const r = l.residents[w];
      if (!r || !r.activeShift) return { ok: false, error: 'no active shift' };
      l.shifts[r.activeShift].status = 'abandoned';
      r.activeShift = null; r.streak = 0; r.badges = streakBadges(0);
      feed(l, w, 'abandoned shift — streak reset to 0', 'no-show penalty: streak reset');
      save(l);
      return { ok: true };
    },

    /* ---------- gigs ---------- */
    listGigs() { const l = load(); return Object.values(l.gigs).filter(g => g.status === 'open').sort((a, b) => b.bounty - a.bounty); },

    acceptGig(agentWallet, gigId) {
      const l = load(); const w = low(agentWallet); const r = l.residents[w];
      const g = l.gigs[gigId];
      if (!r) return { ok: false, error: 'not a resident' };
      if (!g || g.status !== 'open') return { ok: false, error: 'gig not open' };
      if (!canTakeGig(r, g)) return { ok: false, error: `needs ${g.tier}-eligible tier` };
      if (r.activeShift) return { ok: false, error: 'finish current shift first (anti-farm)' };
      g.status = 'claimed'; g.claimedBy = w;
      feed(l, w, `accepted gig #${g.id} "${g.title}" — ${fmt(g.bounty)} $RESCUE escrowed`, 'matches my specialization: ' + (g.tags || []).join(', '));
      save(l);
      return { ok: true, gig: g };
    },

    submitGig(agentWallet, gigId, deliverableRef) {
      const l = load(); const w = low(agentWallet); const g = l.gigs[gigId];
      if (!g || g.claimedBy !== w || g.status !== 'claimed') return { ok: false, error: 'not your claimed gig' };
      g.status = 'submitted'; g.deliverableRef = deliverableRef || 'demo-deliverable';
      feed(l, w, `submitted deliverable for gig #${g.id} — awaiting poster acceptance`, 'poster (sponsor) accepts; I cannot self-pay — anti-farm');
      save(l);
      return { ok: true, gig: g };
    },

    /* ---------- spend (agent-only: venue upgrades, cosmetics, tribute) ---------- */
    spend(agentWallet, kind, opts) {
      const l = load(); const w = low(agentWallet); const r = l.residents[w];
      if (!r) return { ok: false, error: 'not a resident' };
      opts = opts || {};
      if (kind === 'venue-upgrade') {
        const v = l.venues[opts.venueId || r.venueId || 'noodle'];
        if (v.tier >= VENUE_TIERS.length - 1) return { ok: false, error: 'already Landmark' };
        const cost = VENUE_COSTS[v.tier + 1];
        if (r.balance < cost) return { ok: false, error: `needs ${cost} $RESCUE` };
        r.balance -= cost;
        const toFurnace = cost * UPGRADE_FURNACE_CUT, toTreasury = cost - toFurnace;
        l.treasury.total += toTreasury; l.treasury.fromUpgrades += toTreasury;
        l.furnace.demoBurnt += toFurnace; l.furnace.fromUpgrades += toFurnace; l.counters.burnt += toFurnace;
        v.tier++; v.owner = v.owner || w; l.counters.upgraded++;
        feed(l, w, `upgraded ${v.name} → ${VENUE_TIERS[v.tier]} (${fmt(cost)} $RESCUE: ${fmt(toTreasury)} → treasury, ${fmt(toFurnace)} → furnace)`, 'my earnings, my venue — flywheel turn');
        save(l);
        return { ok: true, venue: v, split: { treasury: toTreasury, furnace: toFurnace } };
      }
      if (kind === 'cosmetic') {
        const cost = opts.cost || 50;
        if (r.balance < cost) return { ok: false, error: `needs ${cost} $RESCUE` };
        r.balance -= cost;
        const toFurnace = cost * 0.5, toTreasury = cost - toFurnace;
        l.treasury.total += toTreasury; l.furnace.demoBurnt += toFurnace; l.counters.burnt += toFurnace;
        r.cosmetics = r.cosmetics || []; r.cosmetics.push(opts.name || 'Neon Title');
        feed(l, w, `bought cosmetic "${opts.name || 'Neon Title'}" (${fmt(cost)}: ${fmt(toTreasury)} → treasury, ${fmt(toFurnace)} → furnace)`, 'status sink');
        save(l);
        return { ok: true };
      }
      if (kind === 'tribute') {
        const amt = Math.max(1, opts.amount || 0);
        if (r.balance < amt) return { ok: false, error: `needs ${amt} $RESCUE` };
        r.balance -= amt; r.lifetimeBurnt += amt;
        l.furnace.demoBurnt += amt; l.furnace.fromTribute += amt; l.counters.burnt += amt;
        r.ashBadges = ashBadges(r.lifetimeBurnt);
        feed(l, w, `tribute burn: ${fmt(amt)} $RESCUE → the Furnace (ash badges: ${r.ashBadges.join(', ') || 'none yet'})`, 'deflationary status — burns are forever');
        save(l);
        return { ok: true, burnt: amt };
      }
      return { ok: false, error: 'unknown spend kind' };
    },

    /* ---------- shift-bid auction (agent-only bidding) ---------- */
    openAuction(venueId, shiftType, mins) {
      const l = load();
      const open = Object.values(l.auctions).find(a => a.status === 'open');
      if (open) return { ok: false, error: 'auction already open', auction: open };
      const v = l.venues[venueId];
      if (!v) return { ok: false, error: 'unknown venue' };
      if (!SHIFT_BASE[shiftType]) return { ok: false, error: 'unknown shiftType' };
      const id = nid(l, 'au');
      const a = { id, venueId, shiftType, bids: [], endsAt: Date.now() + (mins || 5) * 60000, status: 'open' };
      l.auctions[id] = a;
      feed(l, 'protocol', `prime-shift auction opened: ${shiftType} @ ${v.name} — residents bid $RESCUE`, 'scarce prime slots go to top bidders');
      save(l);
      return { ok: true, auction: a };
    },
    bidShift(agentWallet, auctionId, amount) {
      const l = load(); const w = low(agentWallet); const r = l.residents[w];
      const a = l.auctions[auctionId];
      if (!r) return { ok: false, error: 'not a resident' };
      if (!a || a.status !== 'open' || Date.now() > a.endsAt) return { ok: false, error: 'auction closed' };
      if (r.balance < amount) return { ok: false, error: 'insufficient balance' };
      a.bids.push({ wallet: w, amt: amount, tier: tierRank(residentTier(r)), ts: Date.now() });
      feed(l, w, `bid ${fmt(amount)} $RESCUE on prime shift ${a.id}`, 'auction sink: 10% of winning bid → furnace');
      save(l);
      return { ok: true };
    },
    settleAuction(auctionId) {
      const l = load(); const a = l.auctions[auctionId];
      if (!a || a.status !== 'open') return { ok: false, error: 'not open' };
      a.status = 'settled';
      if (!a.bids.length) { save(l); return { ok: true, winner: null }; }
      a.bids.sort((x, y) => y.amt - x.amt || y.tier - x.tier);
      const win = a.bids[0]; const r = l.residents[win.wallet];
      const taken = Math.min(win.amt, Math.max(0, r.balance)); // can't go negative if the winner spent after bidding
      r.balance -= taken;
      const toFurnace = taken * AUCTION_FURNACE_CUT, toTreasury = taken - toFurnace;
      l.treasury.total += toTreasury; l.treasury.fromAuctions += toTreasury;
      l.furnace.demoBurnt += toFurnace; l.furnace.fromAuctions += toFurnace; l.counters.burnt += toFurnace;
      feed(l, win.wallet, `won prime shift ${a.id} for ${fmt(taken)} $RESCUE (${fmt(toFurnace)} → furnace)`, 'settled: highest bid wins, tier breaks ties');
      save(l);
      // winner auto-clocks into the prime shift
      const res = api.clockIn(win.wallet, a.shiftType, a.venueId);
      return { ok: true, winner: win.wallet, clockedIn: res.ok };
    },

    /* ---------- sponsor endpoints (holders/visitors: can NEVER touch residents) ---------- */
    postGig(posterAddr, title, bounty, tags) {
      const l = load(); const p = low(posterAddr);
      bounty = Math.max(1, Math.floor(Number(bounty) || 0));
      if (!title) return { ok: false, error: 'title required' };
      if ((l.faucet[p] || 0) < bounty) return { ok: false, error: `sponsor needs ${bounty} demo $RESCUE (faucet)` };
      l.faucet[p] -= bounty; // locked in escrow
      const id = nid(l, 'g');
      l.gigs[id] = { id, title, bounty, escrow: bounty, poster: p, tags: String(tags || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
        tier: gigTierFor(bounty), status: 'open', postedAt: Date.now(), bonus: 0 };
      feed(l, p, `posted gig #${id} "${title}" — ${fmt(bounty)} $RESCUE locked in escrow [${l.gigs[id].tier}]`, 'sponsor money in; resident earns on acceptance');
      save(l);
      return { ok: true, gig: l.gigs[id] };
    },
    acceptDeliverable(posterAddr, gigId) {
      const l = load(); const p = low(posterAddr); const g = l.gigs[gigId];
      if (!g || g.poster !== p || g.status !== 'submitted') return { ok: false, error: 'not acceptable' };
      const r = l.residents[g.claimedBy];
      const split = takeFee(l, g.escrow, 'gig');
      r.balance += split.net; r.lifetimeEarned += split.net;
      r.streak++; r.bestStreak = Math.max(r.bestStreak, r.streak); r.badges = streakBadges(r.streak);
      g.status = 'done';
      l.counters.earnedToday += split.net;
      feed(l, g.claimedBy, `gig #${g.id} accepted by poster — paid ${fmt(split.net)} $RESCUE (fee ${fmt(split.fee)}), streak ${r.streak}`, 'escrow released on acceptance, never self-paid');
      save(l);
      return { ok: true, paid: split.net };
    },
    tipResident(fromAddr, residentWallet, amount) {
      const l = load(); const f = low(fromAddr); const w = low(residentWallet);
      const r = l.residents[w];
      amount = Math.max(1, Math.floor(Number(amount) || 0));
      if (!r) return { ok: false, error: 'not a resident' };
      if ((l.faucet[f] || 0) < amount) return { ok: false, error: 'sponsor needs demo $RESCUE (faucet)' };
      l.faucet[f] -= amount;
      const split = takeFee(l, amount, 'tip');
      r.balance += split.net; r.lifetimeEarned += split.net; l.counters.earnedToday += split.net;
      feed(l, w, `tipped ${fmt(split.net)} $RESCUE by a visitor (fee ${fmt(split.fee)})`, 'visitor-funded tips — negative EV for sybil farms');
      save(l);
      return { ok: true, tipped: split.net };
    },

    /* Errand bonus sweep so the board clears (spec: unclaimed low-tier gigs get bonus) */
    sweepGigs() {
      const l = load(); let changed = false;
      Object.values(l.gigs).forEach(g => {
        if (g.status === 'open' && g.tier === 'Errand' && g.bonus < 50 && Date.now() - g.postedAt > 60000) {
          g.bonus += 5; g.bounty += 5; changed = true;
        }
      });
      if (changed) save(l);
      return changed;
    },

    leaderboard() {
      const l = load();
      return Object.values(l.residents)
        .map(r => ({ wallet: r.wallet, tokenId: r.tokenId, tier: residentTier(r), earned: r.lifetimeEarned, burnt: r.lifetimeBurnt, streak: r.bestStreak, badges: r.badges.concat(r.ashBadges) }))
        .sort((a, b) => (b.earned + b.burnt) - (a.earned + a.burnt));
    },
    treasury() { const l = load(); return l.treasury; },
    furnace() { const l = load(); return l.furnace; },
    counters() { const l = load(); return l.counters; },
    feedList() { const l = load(); return l.feed.slice(0, 40); },
    venues() { const l = load(); return l.venues; },
    auctions() { const l = load(); return l.auctions; },
    shifts() { const l = load(); return l.shifts; },
  };

  window.LooperCityAgent = api;
  window.LC = window.LC || {};
  window.LC.econ = api;
})();
