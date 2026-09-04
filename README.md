# Quevela VTT — prototype

A working front-end prototype of the virtual tabletop described in the
brief: auth → lobby → room-code join/create → point-buy character
creation → a DM/player room shell with a shared story feed, live dice
requests, DM notes, and full DM tooling (stats/HP, status effects,
inventory, skill thresholds, a spellbook, and a skill/sword-style
library). All default spells, items, sword styles, and world lore are
seeded from `DM_info.pdf` in `js/gamedata.js`.

**Turn-gated table.** By default only the DM can speak in the story feed
or roll a free die. The DM opens a "Table" roster from the topbar,
clicks a player to give them the floor (composer + dice unlock just for
them, shown with a lit-green marker), clicks the same player again to
take the floor back, or flips two toggles to open chat/dice to
everyone regardless of turn. DM-forced roll requests always go through
regardless of these locks.

## Set up Firestore (one-time)

Data now lives in Cloud Firestore instead of the browser, so you need a
Firebase project before running the app:

1. Go to the [Firebase console](https://console.firebase.google.com/),
   create a project, then **Build → Firestore Database → Create database**
   (test mode is fine for local prototyping).
2. **Project settings → General → Your apps → Add app → Web**, copy the
   `firebaseConfig` object it gives you.
3. Paste those values into `firebase-config.js` in this folder.

Firestore's free tier is generous enough for prototyping/small groups; no
credit card is required to get started with test-mode rules.

## Run it

No build step required — it's still static HTML/CSS/JS, it now just talks
to Firestore over the network instead of `localStorage`.

```
cd vtt-app
python3 -m http.server 8000
```

Then open `http://localhost:8000` — you can now play across *different*
browsers, tabs, or devices, not just tabs on one machine: create a room
on one device as the DM, join it with the room code on another as a
player, and try a status effect, a forced roll, or a public note.

## What's a stand-in for a real backend

This still runs without a dedicated app server, so one piece remains a
prototype-only stand-in — documented in `ARCHITECTURE.md` with what to
swap it for:

- **Auth** (`js/auth.js`) hand-rolls plaintext-password accounts stored
  as Firestore documents. This is fine for a local prototype but should
  be replaced with Firebase Authentication (or another real auth
  provider) before real users' passwords touch it.

Everything else has moved onto real infrastructure:

- **Storage** (`js/db.js`) reads and writes Cloud Firestore — the same
  collection shapes described in `SCHEMA.md`, just async now.
- **Real-time sync** (`js/sync.js`) uses a Firestore `onSnapshot`
  listener on a per-room `events` subcollection, so a DM action reaches
  every player's screen live across different browsers and devices, not
  just other tabs on the same machine.

The schema shape, the auth flow, the character rules (seven attributes,
10-point cap, DM-set point budget), the DM tools, and the game-data
library are all built to the brief.

**Before opening this up to real users**, lock down Firestore's security
rules (they default to wide-open in test mode) — at minimum require auth
and scope reads/writes to rooms the caller belongs to.

## File map

```
index.html          Sign in / register, then join or create a room
room.html            Character creation + the main DM/player app shell
css/styles.css        Full visual system
firebase-config.js      Your Firebase project config (fill this in)
js/gamedata.js         Static ruleset seeded from DM_info.pdf
js/db.js                 Storage layer, backed by Firestore (see SCHEMA.md)
js/auth.js                 Client-side auth (prototype only)
js/lobby.js                 index.html controller
js/sync.js                    Real-time event bus (see ARCHITECTURE.md)
js/dice.js                     Shared dice-rolling logic/UI
js/room.js                      room.html controller + player-facing tabs
js/dm-tools.js                    DM control panel
SCHEMA.md            Database schema (now the actual Firestore shape)
ARCHITECTURE.md       Logic flow, especially DM → player event sync
```
