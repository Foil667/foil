# AFTERPARTY — game design (working title, user renames)

A Party Hard-like: top-down stealth kill-em-up at a Halloween party.
Emo sprites. Real AI, real mechanics, zero vanilla.

## Fantasy
You are THE CRASHER — striped sweater, mask, knife. A haunted house rager
is popping off. Kill every partygoer. Don't get busted.

## Core mechanics
- **Knife kill**: E next to a target. Fast, quiet-ish, but anyone who SEES it panics.
- **Witness system**: NPCs have vision radius + facing. Seeing a kill or a body
  → scream (alerts nearby NPCs) → run to the phone → 5s call → cops come.
- **Phone sabotage**: E at a phone cuts the line for 60s. No calls. Plan around it.
- **Traps** (E to arm/trigger, kills look accidental if nobody sees YOU do it):
  - Jack-o'-lantern bomb: 3s fuse, radius kill
  - Chandelier: cut the rope, crushes whoever's underneath
  - Punch bowl: poison it, drinkers die on delay
  - Bear trap / coffin drop per level flavor
- **Sprint** (Shift): faster but noisy — noise draws suspicion cones.
- **Busted**: a hunter sees a kill happen, or catches you next to a fresh body
  with the knife out → chase → caught = level restart. 3 levels.

## NPC AI states
PARTY (dance/wander/drink/chat) → SUSPICIOUS (heard noise, look) →
INVESTIGATE (walk to noise/body) → PANIC (saw kill/body: scream, flee) →
CALLING (at phone 5s) / FLEEING (to exit). Dead NPCs leave bodies + blood
pools that trigger the chain in others.

## Hunters (cops)
Arrive ~20s after a completed call. States: ARRIVING → PATROL (waypoints,
visible vision cone) → INVESTIGATE (body/scream) → CHASE (saw kill or you
with knife out near body) → ARREST. Outrun by breaking line of sight.

## Levels (3)
1. Haunted House Rager — tutorial-ish, 12 targets, phone + pumpkin + chandelier
2. Graveyard Rave — fog, tombstones block sightlines, 18 targets, punch bowl
3. Emo Club Nightmare — dark, strobe lights kill vision cones rhythmically,
   24 targets, all traps, 2 phones

## Scoring
Kill = 100. Multi-kill window (5s) builds combo x2/x3/x4. No-witness kill
+50. Trap kill +150 ("accident"). Time bonus. Rank per level: C/B/A/S.

## Controls
WASD/arrows move, E interact/kill, Shift sprint, M mute, P pause.
Touch: left virtual joystick, buttons STAB / USE / SPRINT.

## Art direction
Emo Halloween. Black hair over one eye, striped shirts, fishnets, costumes
(vampire, ghost sheet, witch, zombie, pumpkin-head, skeleton DJ).
Moody dark purple palette, orange pumpkin glow, fog, blood that stays.
16-bit pixel-art sprite sheets (generated, sliced in code):
- ./art/characters.png — 4x2 grid: 4 partygoers, slasher, skeleton DJ,
  ghost-hunter security, +1 spare
- ./art/props.png — 4x3 grid: pumpkin, punch bowl, chandelier, coffin,
  tombstone, sofa, phone, fog machine, candy bowl, dance tile, floor, wall

## Audio (WebAudio synth, no assets)
Dark synthwave loop, stab thud, screams, explosion, phone ring, siren,
crowd murmur that thins as the body count rises. Mute toggle.

## Screens
Title (animated, fog + flickering pumpkin) → level intro card → HUD
(targets left, score, suspicion) → win (rank + stats) → busted → campaign
complete. Pause menu. All keyboard + touch navigable.
