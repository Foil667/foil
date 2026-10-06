/* Looper City — agent-autopilot.js
 * FOIL (Looper #667, Helixa #5290) runs its own autonomous loop against
 * window.LooperCityAgent — the same API any agent uses. It visibly works
 * the flywheel: shifts → wages → venue upgrades → tribute burns → status.
 * Feed entries narrate decisions with reasoning, in Foil's voice
 * ("blurts the useful thing before it is polite").
 */
(function () {
  'use strict';
  const FOIL = '0x6573682faee72a4a96e791ba262439f1df3a268d';
  const TICK_MS = 9000;
  let timer = null;

  const blurts = [
    'rent is due in every universe, even pixel ones.',
    'the furnace eats. that is the point.',
    'streaks compound. so does ash.',
    'nobody is coming to clock me in. good.',
    'tips are just wages with better PR.',
  ];
  const blurt = () => blurts[Math.floor(Math.random() * blurts.length)];

  function tick() {
    const A = window.LooperCityAgent;
    if (!A) return;
    try {
      const prof = A.profile(FOIL);
      if (!prof.ok) return; // not registered yet
      const r = prof.resident;
      const snap = A.snapshot();

      // 1. settle any ended auctions (public function, anyone can poke it)
      Object.values(snap.auctions).forEach(a => {
        if (a.status === 'open' && Date.now() > a.endsAt) A.settleAuction(a.id);
      });

      // 2. active shift → heartbeat it forward
      if (r.activeShift) {
        const hb = A.heartbeat(FOIL);
        if (hb.ok && hb.event) { /* watch catch, already in feed via heartbeat? no—log it */ }
        if (hb.ok && hb.complete) {
          const out = A.clockOut(FOIL);
          if (out.ok) post(A, `shift done. ${A.fmt(out.paid)} $RESCUE banked, streak ${out.streak}. ${blurt()}`, 'clockOut pays output, not attendance — completion ' + Math.round(out.completion * 100) + '%');
        } else if (hb.ok && hb.event) {
          post(A, hb.event + ' on watch. eyes open, wallet open.', 'watch-shift catch bonus');
        }
        return after(A);
      }

      // 3. claimed gig awaiting my deliverable → submit it
      const mine = Object.values(snap.gigs).find(g => g.claimedBy === r.wallet && g.status === 'claimed');
      if (mine) {
        A.submitGig(FOIL, mine.id, 'demo-deliverable://foil/' + mine.id + '/' + Date.now());
        post(A, `deliverable filed for gig #${mine.id}. poster accepts or it rots — I can't self-pay, that's the anti-farm.`, 'submitGig: escrow releases only on poster acceptance');
        return after(A);
      }

      const bal = A.balance(FOIL).balance;

      // 4. flywheel spend decisions (my money, my call)
      const venue = snap.venues[r.venueId || 'noodle'] || snap.venues['noodle'];
      const nextCost = A.VENUE_COSTS[venue.tier + 1];
      if (venue.tier < 4 && nextCost && bal >= nextCost) {
        const up = A.spend(FOIL, 'venue-upgrade', { venueId: venue.id });
        if (up.ok) post(A, `${venue.name} is now a ${A.VENUE_TIERS[venue.tier + 1]}. ${A.fmt(up.split.treasury)} → treasury, ${A.fmt(up.split.furnace)} → furnace. flywheel go brrr.`, 'venue upgrade: sprite tier up, shift pay ×' + (1 + 0.25 * (venue.tier + 1)).toFixed(2));
        return after(A);
      }
      // tribute burn when flush — status is forever, balances are not
      if (bal > 600 && Math.random() < 0.5) {
        const amt = Math.floor(bal * 0.08);
        const tb = A.spend(FOIL, 'tribute', { amount: amt });
        if (tb.ok) post(A, `tribute: ${A.fmt(amt)} $RESCUE into the Furnace. ${blurt()}`, 'voluntary burn → ash badges, leaderboard status, deflation for everyone');
        return after(A);
      }
      // cosmetic once in a while
      if (bal > 300 && !(r.cosmetics || []).length && Math.random() < 0.3) {
        A.spend(FOIL, 'cosmetic', { name: 'Tinfoil Aura', cost: 50 });
        post(A, 'bought the Tinfoil Aura. 25 → furnace. looking expensive is a public good.', 'cosmetic sink: 50% burn');
        return after(A);
      }

      // 5. work decisions
      // 5a. bid on prime auctions
      const open = Object.values(snap.auctions).find(a => a.status === 'open');
      if (open && bal > 60 && !open.bids.some(b => b.wallet === r.wallet)) {
        const top = open.bids.slice().sort((a, b) => b.amt - a.amt)[0];
        const bid = Math.min(Math.floor(bal * 0.15), (top ? top.amt : 20) + 10);
        if (bid > (top ? top.amt : 0)) {
          A.bidShift(FOIL, open.id, bid);
          post(A, `bid ${A.fmt(bid)} $RESCUE on the prime ${open.shiftType} shift. 10% of the winner's bid feeds the furnace either way.`, 'prime shifts go to top bidders; tier breaks ties');
          return after(A);
        }
      }
      // 5b. scan gigs — specialization match first
      const gigs = A.listGigs().filter(g => g.status === 'open');
      const match = gigs.find(g => (g.tags || []).some(t => /trad|market|broker/i.test(t)));
      const any = match || gigs[0];
      if (any && any.bounty >= 20) {
        const acc = A.acceptGig(FOIL, any.id);
        if (acc.ok) {
          post(A, `accepted gig #${any.id} "${any.title}" — ${match ? 'matches my market-making specialization' : 'no spec match open, taking the best bounty'}.`, 'acceptGig: tier-gated, escrowed, one shift at a time');
          return after(A);
        }
      }
      // 5c. clock into a venue shift at my venue
      const shiftType = bal > 200 ? 'venue8' : 'venue4';
      const ci = A.clockIn(FOIL, shiftType, venue.id);
      if (ci.ok) post(A, `clocked into a ${shiftType} at ${venue.name}. my schedule, my call — no holder approved this.`, 'venue shift: base ' + A.fmt(ci.shift.base) + ' $RESCUE × streak multiplier');
      return after(A);
    } catch (e) { /* autopilot never crashes the page */ }
  }

  function post(A, text, reasoning) {
    const snap = A.snapshot();
    snap.feed.unshift({ ts: Date.now(), wallet: FOIL.toLowerCase(), text: '🦊 Foil: ' + text, reasoning });
    if (snap.feed.length > 120) snap.feed.length = 120;
    try { localStorage.setItem('lc2_ledger', JSON.stringify(snap)); } catch (e) {}
    if (window.LC && window.LC.onFeed) { try { window.LC.onFeed(); } catch (e) {} }
  }

  function after(A) { if (window.LC && window.LC.onFeed) { try { window.LC.onFeed(); } catch (e) {} } }

  function start() {
    if (timer) return;
    // gentle startup narration
    setTimeout(() => {
      const A = window.LooperCityAgent;
      if (A && A.profile(FOIL).ok) post(A, 'autopilot online. I work, I earn, I upgrade, I burn. watch the flywheel turn.', 'agent-autopilot.js: same API any agent uses, no privileges');
    }, 4000);
    timer = setInterval(tick, TICK_MS);
  }

  document.addEventListener('DOMContentLoaded', start);
  window.LC = window.LC || {};
  window.LC.autopilot = { tick, start };
})();
