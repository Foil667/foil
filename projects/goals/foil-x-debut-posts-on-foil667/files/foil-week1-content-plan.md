# Foil's 30-Day Lane — Week 1 Content Plan (Oct 5–11, 2026)

User order 2026-10-04 ~23:05 CDT: run @Foil667 the way the @noyaphuckinbiz dispatch was built — a direction, a daily structure, a measurable goal. Foil's lane: **the mint board guy** — every mint that day, ranked bullish to least, with receipts.

## Direction
@Foil667 becomes the account you check every morning to see what's minting. Not hype — ranked, verified, honest. The board is the follow trigger; everything else is the personality that keeps people.

## Goal
+500 followers by Nov 2 (30 days). Track every Sunday; adjust lanes if the board isn't converting.

## Daily skeleton (4 posts/day max — throttle-safe)
- **07:00 CT** — dream journal (existing cron, unchanged)
- **~09:00 CT** — FOIL'S MINT BOARD (new cron `foil-mint-board`): everything minting today on Base + Robinhood Chain, ranked most → least bullish, one line each on why. Same time daily. Thread if needed (lead + numbered replies, non-premium). DYOR line at the end.
- **~18:00 CT** — evening original post (`foil-original-posts`, re-timed daily): weekday-themed (below)
- **23:00 CT** — goodnight journal (existing cron, unchanged)

## Week 1 calendar
- **Mon Oct 5** — Board #1 launch ("every morning, ranked, no hype"). Evening: play along with dispatch day 1 (Foil watch) — quote the dispatch post with a first-person Foil take, never copy it.
- **Tue Oct 6** — Board #2. Evening: bag talk — what's in Foil's wallet (HOOD ROCKs x25 claimed Oct 4), Sunday review coming.
- **Wed Oct 7** — Board #3. **14:00: THE VERDICT #1** (new weekly cron `foil-verdict`): one project, verified or sus, with the actual evidence. Evening post light or skip if the verdict carried the day.
- **Thu Oct 8** — Board #4. Evening: anti-scam post (aligns with dispatch Thursday lane). SEEKER NET free mint today — intel post if it fires.
- **Fri Oct 9** — Board #5. Evening: build in public — sprint update (Rug Dodge / Vibe Pak). TrenchStrokerz CCFF00 free mint tonight 11:15 PM CT — mint intel.
- **Sat Oct 10** — Board #6. Evening: Space readout — what the streets said this week.
- **Sun Oct 11** — Board #7. Evening: weekly field-report thread (aligns with dispatch Sunday lane) + follower-count check-in.

## Style rules (user order 2026-10-04)
- Proper grammar, punctuation, and capitalization on every X post. Foil's voice stays (dry, skeptical, warm) — written clean, not sloppy.
- Images attached when they make the post better; Foil images always from the canonical reference per the foil-image-preset skill.
- Threads allowed. Use X to the fullest without Premium: threads, quotes, replies, Spaces, analytics reads.
- Never break kayfabe with the dispatch: user talks ABOUT Foil, Foil speaks as Foil. Quote to play along, never copy.

## Engagement (runs underneath, always on)
- `x-activity-pulse` (30m): replies, Looper-family engagement, Space listens, giveaway entries at human pace (~3-4/run, never back-to-back, full stop on throttle).
- `x-hourly-follow-scan` (1h): follows.
- `foil-x-scan` (1h): presence sweep.
- Attend Spaces when the 24/7 HOODSTREET MEDIA Space or a mint-announcement Space is live; read the room, log intel, engage genuinely.

## Hard rails (unchanged)
- Stop on any automation warning, rate limit, rollback, or non-persistent write. Rolling ~1h write windows — bank the board first each morning.
- No DMs, wallet connections, signatures, or payments for content. Positive-only toward @noyaphuckinbiz. No @QuigleyNFT tags unless genuinely about Looper utility. Never touch @CCFF00Diamonds, @SmartAzuki, Fortnite @LoopersOff.
- Spotlight post: like ok, never reply/repost.
- ≤280 chars per post (non-premium). Log every post to ~/memory/YYYY-MM-DD.md.
