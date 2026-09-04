# Database schema

This prototype stores everything in `localStorage` (see `js/db.js`), but every
collection there is shaped like a real table so moving to Postgres (or any
relational/document store) is a drop-in swap — replace the functions in
`db.js` with API calls, keep the same shapes.

## `users`
| column         | type      | notes                              |
|----------------|-----------|-------------------------------------|
| id             | uuid pk   |                                     |
| username       | text unique |                                   |
| password_hash  | text      | **never plaintext** in production — this demo uses plaintext only because there is no server |
| created_at     | timestamp |                                     |

## `rooms`
| column        | type       | notes                                              |
|---------------|------------|-----------------------------------------------------|
| id            | uuid pk    |                                                     |
| code          | text unique| short join code, e.g. `4F9K2`                       |
| name          | text       |                                                     |
| dm_user_id    | uuid fk -> users.id | the room creator; permanent DM for this room |
| point_budget  | int        | starting attribute points the DM grants every player |
| active_character_id | uuid fk -> characters.id, null | whose turn it currently is; null if nobody's |
| chat_unlocked | boolean    | true if the DM has opened chat to every player, regardless of turn |
| roll_unlocked | boolean    | true if the DM has opened free dice rolling to every player, regardless of turn |
| created_at    | timestamp  |                                                     |

## `characters`
One row per (user, room) pair — a user's character in that specific room.

| column           | type        | notes                                                     |
|------------------|-------------|-------------------------------------------------------------|
| id               | uuid pk     |                                                               |
| room_id          | uuid fk -> rooms.id |                                                       |
| user_id          | uuid fk -> users.id |                                                       |
| name             | text        |                                                               |
| is_dm            | boolean     | true only for the room creator's own character row           |
| built            | boolean     | false until the player finishes character creation           |
| skipped          | boolean     | true if the DM opted out of playing a character              |
| stats            | jsonb       | `{ Damage, Speed, Stealth, Vitality, Magic, Knowledge, Fortitude }`, each 0–10 |
| points_spent     | int         |                                                               |
| hp_current       | int         |                                                               |
| hp_max           | int         |                                                               |
| status_effects   | jsonb array | list of effect name strings, e.g. `["Burned"]`                |
| inventory        | jsonb array | `[{ name, qty }]`                                             |
| created_at       | timestamp   |                                                               |

## `messages`
The shared story feed (chat, system lines, dice-roll results, whispers).

| column       | type      | notes                                       |
|--------------|-----------|-----------------------------------------------|
| id           | uuid pk   |                                                |
| room_id      | uuid fk -> rooms.id |                                      |
| author_id    | text      | a `characters.id`, or the literal `"system"`  |
| author_name  | text      | denormalized for fast rendering                |
| type         | enum      | `chat` \| `system` \| `roll` \| `whisper`     |
| text         | text      |                                                |
| meta         | jsonb null| optional structured payload (e.g. roll detail)|
| created_at   | timestamp |                                                |

## `dice_requests`
| column               | type      | notes                                   |
|----------------------|-----------|-------------------------------------------|
| id                   | uuid pk   |                                            |
| room_id              | uuid fk -> rooms.id |                                  |
| target_character_id  | uuid fk -> characters.id | who must roll             |
| requested_by         | uuid fk -> users.id | the DM                          |
| sides                | int       | 4 / 6 / 8 / 10 / 12 / 20 / 100             |
| label                | text null | e.g. "Stealth check"                       |
| status               | enum      | `pending` \| `completed`                   |
| result               | int null  |                                             |
| created_at           | timestamp |                                             |

## `dm_notes`
| column        | type      | notes                                  |
|---------------|-----------|-------------------------------------------|
| id            | uuid pk   |                                            |
| room_id       | uuid fk -> rooms.id |                                  |
| author_id     | uuid fk -> users.id | always the DM                      |
| text          | text      |                                            |
| visibility    | enum      | `private` (DM only) \| `public` (shown on every player's DM Notes tab) |
| created_at    | timestamp |                                            |

## `custom_skills`
DM-authored skills/spells with an attribute-threshold unlock condition,
layered on top of the seeded `GameData` library (`js/gamedata.js`).

| column               | type      | notes                                      |
|----------------------|-----------|-----------------------------------------------|
| id                   | uuid pk   |                                                |
| room_id              | uuid fk -> rooms.id |                                      |
| name                 | text      |                                                |
| description          | text      |                                                |
| threshold_attribute  | enum      | one of the seven core attributes               |
| threshold_value      | int       | 0–10; unlocked once the character's attribute meets/exceeds this |
| created_at           | timestamp |                                                |

## Seeded reference data (not user-editable rows)
`js/gamedata.js` holds the static ruleset pulled from `DM_info.pdf` —
the four elemental magic trees (Fire/Water/Wind/Earth) with their
tiers (Beginner → Intermediate → Advanced → Unique → Ultimate, plus
sub-category cross-element spells), Intellectual skills, items
(scrolls, potions, gear by race with quality tiers, artifacts), the
four sword styles and their mastery ladder, the world of Quevela and
its five regions, races/factions, enemies, and the Adventurers' Guild
ranks. In a production build this becomes a `game_data` table (or a
versioned JSON blob) served from `GET /api/gamedata`, with `custom_skills`
layered on top per room exactly as it is here.
