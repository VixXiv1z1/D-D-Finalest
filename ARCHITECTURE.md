# Architecture & logic flow

## App flow

```
index.html (auth + lobby)
   │  sign in / register  →  DB.createUser / DB.findUser
   │  create room         →  DB.createRoom  (creator becomes permanent DM)
   │  join room            →  DB.getRoomByCode
   ▼
room.html
   │  no character yet?   →  character creation screen (point-buy, 7 attributes, cap 10)
   ▼
   app shell
   ├─ left sidebar   → only rendered for a DM who chose to also play a character;
   │                    mirrors the standard player layout exactly (Stats / Condition / DM Notes / Dice)
   ├─ center column  → shared story feed + composer (same component for DM and players)
   └─ right sidebar  → Player: Stats / Condition / DM Notes / Dice
                        DM:     Notes / Events / Stats & HP / Inventory / Dice / Skills
```

## Why a room creator is "permanently" the DM

`rooms.dm_user_id` is set once, at `DB.createRoom()`, and every subsequent
check (`isDM = room.dmUserId === user.id`) reads that same field — there is
no code path that reassigns it, so the role sticks for the life of the room.

## Real-time: how a DM action reaches a player's screen

Every DM Tools action follows the same three-step pattern
(see `js/dm-tools.js`):

1. **Write** — mutate the target character (or note, or dice request) and
   persist it through `db.js`.
2. **Broadcast** — call `Sync.emit(eventType, payload)`.
3. **React** — every open tab's `Sync.on(eventType, handler)` listener
   (registered in `room.js`) re-renders only the panel that changed.

```
DM clicks "Send roll request" (dm-tools.js)
   → DB.createDiceRequest({ roomId, targetCharacterId, sides, label })
   → Sync.emit("dice:request", { request })
        │
        ├─ DM's own tab: local listeners in Sync.emit fire immediately
        └─ BroadcastChannel("vtt-room-<code>") → every other open tab
                → room.js: Sync.on("dice:request", ...) 
                      if request.targetCharacterId === myCharacter.id
                      → render the die on that player's Dice tab
Player rolls (dice.js)
   → DB.completeDiceRequest(id, result)
   → DB.addMessage({ type: "roll", ... })
   → Sync.emit("chat:new", { message })      // shows in the shared story feed
   → Sync.emit("dice:result", { request })   // clears the request card everywhere
```

The same write → broadcast → react pattern covers every DM tool:

| DM action                        | Sync event           | Player-side effect                              |
|-----------------------------------|-----------------------|--------------------------------------------------|
| Adjust stats / HP                 | `character:update`    | Stats bars and HP bar update live                |
| Apply / remove a status effect    | `character:update`    | Condition tab's status chips update live         |
| Add / remove inventory items      | `character:update`    | Condition tab's inventory list updates live      |
| Force a roll                      | `dice:request` → `dice:result` | Die appears on the Dice tab, then resolves |
| Push a public note                | `note:public`         | Appears on every player's read-only DM Notes tab |
| Define a custom skill + threshold | `skill:new`           | Unlocks automatically once a player's attribute meets the threshold — no per-player assignment needed |
| Click a player in the table roster | `turn:update`        | That player's composer/dice unlock; clicking the same player again clears the turn for everyone |
| Toggle "open chat to everyone"     | `chat:lock`           | Every player's composer unlocks/locks regardless of whose turn it is |
| Toggle "open dice to everyone"     | `roll:lock`           | Every player's free-roll button unlocks/locks regardless of whose turn it is |

Chat messages (`chat:new`) use the same bus and are how the story feed
stays identical for the DM and every player, including system lines like
"X rolled a 14" or "X received 2× Healing Potion."

**Turn-gated chat and dice.** By default a room's `activeCharacterId` is
null and both `chatUnlocked`/`rollUnlocked` are false, so nobody but the
DM can post to the story feed or roll a free die. The DM controls this
from the roster dropdown (the "Table" button in the topbar): clicking a
player's name makes it their turn (composer + free-roll unlock just for
them), clicking that same name again clears the turn for the whole
table, and the two checkboxes open chat/dice to everyone irrespective of
turn. A DM-forced roll request (`dice:request`) always reaches its
target regardless of these locks, since that's an explicit ask from the
DM rather than a free action.

## Swapping the prototype's plumbing for production

- **`db.js`** — replace each function body with a `fetch()` call to a real
  API; the function signatures and returned shapes are already what the UI
  expects, so nothing else changes. Backing store: Postgres per `SCHEMA.md`.
- **`sync.js`** — replace `BroadcastChannel` with a WebSocket (or Socket.IO)
  client. Keep the same `Sync.emit(type, payload)` / `Sync.on(type, fn)`
  interface; the server just needs to fan out anything a client emits to
  every other client in that room's channel, and validate that only the
  room's DM can emit DM-tool events server-side (the client-side `isDM`
  check in `room.js` is a UX convenience, not a security boundary).
- **`auth.js`** — move password checking server-side with hashed
  credentials and issue a session token instead of storing a plaintext
  user id in `localStorage`.

## Custom skills & thresholds

`custom_skills` rows are room-scoped and never stored "on" a character.
Unlock state is computed, not written: `js/room.js`'s
`renderConditionPanel()` filters `DB.getCustomSkills(roomId)` down to the
ones where `character.stats[skill.thresholdAttribute] >= skill.thresholdValue`.
That means raising a stat via DM Tools can retroactively unlock a skill
without any extra bookkeeping — and it can never drift out of sync with
the attribute that governs it.
