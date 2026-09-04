/**
 * room.js — controller for room.html: character creation, the shared
 * story feed, and the player-facing Stats / Condition / DM Notes / Dice
 * tabs. DM-only tooling lives in dm-tools.js; both files cooperate over
 * the same DOM and the Sync event bus.
 */

const STAT_COLORS = {
  Damage: "var(--fire)",
  Speed: "var(--wind)",
  Stealth: "var(--earth)",
  Vitality: "var(--danger)",
  Magic: "var(--mana)",
  Knowledge: "var(--water)",
  Fortitude: "var(--parchment-dark)",
};

let session, user, room, myCharacter, isDM;

async function boot() {
  session = DB.getSession();
  if (!session) return (window.location.href = "index.html");
  [user, room, myCharacter] = await Promise.all([
    DB.getUser(session.userId),
    DB.getRoom(session.roomId),
    DB.getCharacter(session.characterId),
  ]);
  if (!user || !room || !myCharacter) return (window.location.href = "index.html");
  isDM = room.dmUserId === user.id;

  Sync.connect(room.id);
  wireSyncListeners();
  wireRosterButton();

  if (!myCharacter.built) {
    showCreationView();
  } else {
    showAppView();
  }
}

/* ==================================================================
 * Turn / speaking-rights helpers
 * ================================================================== */

function isMyTurn() {
  return !!room.activeCharacterId && room.activeCharacterId === myCharacter.id;
}

function canSpeak() {
  return isDM || isMyTurn() || !!room.chatUnlocked;
}

function canRoll() {
  return isDM || isMyTurn() || !!room.rollUnlocked;
}

/* ==================================================================
 * Character creation
 * ================================================================== */

function showCreationView() {
  document.getElementById("creationView").classList.remove("hidden");
  document.getElementById("appView").classList.add("hidden");

  const budget = room.pointBudget;
  document.getElementById("creationBudgetLine").textContent =
    `Distribute your ${budget} points across the seven attributes. No attribute may exceed ${GameData.attributeCap}.`;
  document.getElementById("creationCharName").value = myCharacter.name || "";

  const stats = { ...myCharacter.stats };
  const rowsEl = document.getElementById("creationStatRows");
  rowsEl.innerHTML = "";

  function pointsUsed() {
    return Object.values(stats).reduce((a, b) => a + b, 0);
  }
  function refreshRemaining() {
    document.getElementById("pointsRemaining").textContent = budget - pointsUsed();
  }

  GameData.attributes.forEach((attr) => {
    const row = document.createElement("div");
    row.className = "stat-editor-row";
    row.innerHTML = `
      <span class="stat-name">${attr}</span>
      <div class="stepper">
        <button type="button" data-dir="-1" data-attr="${attr}">−</button>
        <span class="val" id="val-${attr}">${stats[attr]}</span>
        <button type="button" data-dir="1" data-attr="${attr}">+</button>
      </div>
    `;
    rowsEl.appendChild(row);
  });

  rowsEl.querySelectorAll("button[data-attr]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const attr = btn.dataset.attr;
      const dir = Number(btn.dataset.dir);
      const next = stats[attr] + dir;
      if (next < 0 || next > GameData.attributeCap) return;
      if (dir > 0 && pointsUsed() + 1 > budget) return;
      stats[attr] = next;
      document.getElementById(`val-${attr}`).textContent = next;
      refreshRemaining();
    });
  });
  refreshRemaining();

  const skipBtn = document.getElementById("skipCharacterBtn");
  if (isDM) {
    skipBtn.classList.remove("hidden");
    skipBtn.onclick = async () => {
      myCharacter.built = true;
      myCharacter.skipped = true;
      myCharacter = await DB.upsertCharacter(myCharacter);
      Sync.emit("character:update", { character: myCharacter });
      showAppView();
    };
  } else {
    skipBtn.classList.add("hidden");
  }

  document.getElementById("saveCharacterBtn").onclick = async () => {
    const name = document.getElementById("creationCharName").value.trim();
    const msg = document.getElementById("creationMsg");
    if (!name) {
      msg.textContent = "Give your character a name first.";
      return;
    }
    myCharacter.name = name;
    myCharacter.stats = stats;
    myCharacter.pointsSpent = pointsUsed();
    myCharacter.built = true;
    myCharacter = await DB.upsertCharacter(myCharacter);
    Sync.emit("character:update", { character: myCharacter });
    const message = await DB.addMessage({
      roomId: room.id,
      authorId: "system",
      authorName: "System",
      type: "system",
      text: `${name} has joined the table.`,
    });
    Sync.emit("chat:new", { message });
    showAppView();
  };
}

/* ==================================================================
 * Main app shell
 * ================================================================== */

function showAppView() {
  document.getElementById("creationView").classList.add("hidden");
  document.getElementById("appView").classList.remove("hidden");

  document.getElementById("roomName").textContent = room.name;
  document.getElementById("roomCode").textContent = room.code;
  document.getElementById("charNameLabel").textContent = myCharacter.name;
  const pill = document.getElementById("rolePill");
  pill.textContent = isDM ? "Dice Master" : "Player";
  pill.classList.toggle("dm-pill", isDM);

  const grid = document.getElementById("roomGrid");
  const leftSidebar = document.getElementById("leftSidebar");

  if (isDM) {
    grid.classList.remove("no-left");
    if (myCharacter.built && !myCharacter.skipped) {
      leftSidebar.classList.remove("hidden");
      wireTabBar(document.getElementById("leftTabBar"), leftSidebar);
      renderPlayerTabs("left", myCharacter);
    } else {
      leftSidebar.classList.add("hidden");
      grid.classList.add("no-left");
    }
    DMTools.render(document.getElementById("rightTabBar"), document.getElementById("rightPanels"), room);
  } else {
    grid.classList.add("no-left");
    leftSidebar.classList.add("hidden");
    renderRightAsPlayer();
  }

  renderStoryFeed();
  wireComposer();
  renderRoster();
  refreshComposerLock();
}

function wireTabBar(tabBar, sidebar) {
  tabBar.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBar.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      sidebar.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      sidebar.querySelector(`[data-panel="${btn.dataset.tab}"]`).classList.add("active");
    });
  });
}

/* ---- Right sidebar as a standard Player panel (Stats/Condition/Notes/Dice) ---- */

function renderRightAsPlayer() {
  const tabBar = document.getElementById("rightTabBar");
  const panels = document.getElementById("rightPanels");
  tabBar.innerHTML = `
    <button data-tab="stats" class="active">Stats</button>
    <button data-tab="condition">Condition</button>
    <button data-tab="notes">DM Notes</button>
    <button data-tab="dice">Dice</button>
  `;
  panels.innerHTML = `
    <div class="tab-panel active" data-panel="stats" id="playerStatsPanel"></div>
    <div class="tab-panel" data-panel="condition" id="playerConditionPanel"></div>
    <div class="tab-panel" data-panel="notes" id="playerNotesPanel"></div>
    <div class="tab-panel" data-panel="dice" id="playerDicePanel"></div>
  `;
  wireTabBar(tabBar, document.getElementById("rightSidebar"));
  renderPlayerTabs("player", myCharacter);
}

/**
 * Renders the four standard tab panels for a given character. `prefix`
 * is "left" (DM's own character sidebar) or "player" (a normal player's
 * only sidebar) — both use the exact same layout, per spec.
 */
async function renderPlayerTabs(prefix, character) {
  renderStatsPanel(document.getElementById(`${prefix}StatsPanel`), character);
  await Promise.all([
    renderConditionPanel(document.getElementById(`${prefix}ConditionPanel`), character),
    renderNotesPanel(document.getElementById(`${prefix}NotesPanel`)),
    renderDicePanel(document.getElementById(`${prefix}DicePanel`), character),
  ]);
}

function renderStatsPanel(container, character) {
  if (!container) return;
  container.innerHTML = "";
  GameData.attributes.forEach((attr) => {
    const val = character.stats[attr] || 0;
    const row = document.createElement("div");
    row.className = "stat-row";
    row.innerHTML = `
      <span class="stat-name">${attr}</span>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${(val / GameData.attributeCap) * 100}%; background:${STAT_COLORS[attr]}"></div></div>
      <span class="stat-val">${val}</span>
    `;
    container.appendChild(row);
  });
}

async function renderConditionPanel(container, character) {
  if (!container) return;
  const hpPct = Math.max(0, Math.min(100, (character.hp.current / character.hp.max) * 100));
  const skills = await DB.getCustomSkills(room.id);
  const unlocked = skills.filter(
    (s) => (character.stats[s.thresholdAttribute] || 0) >= s.thresholdValue
  );

  container.innerHTML = `
    <div class="hp-block">
      <div class="hp-numbers"><span>HP</span><span>${character.hp.current} / ${character.hp.max}</span></div>
      <div class="hp-track"><div class="hp-fill" style="width:${hpPct}%"></div></div>
    </div>
    <div style="margin-bottom:20px;">
      <label>Status effects</label>
      <div id="statusChips-${container.id}">
        ${character.statusEffects.length ? character.statusEffects.map((s) => `<span class="status-chip">${escapeHtml(s)}</span>`).join("") : `<span style="color:var(--text-lo); font-size:12.5px;">None active</span>`}
      </div>
    </div>
    <div style="margin-bottom:20px;">
      <label>Inventory</label>
      ${character.inventory.length ? character.inventory.map((i) => `<div class="inventory-item"><span>${escapeHtml(i.name)}</span><span class="qty">×${i.qty}</span></div>`).join("") : `<p style="color:var(--text-lo); font-size:12.5px;">Empty.</p>`}
    </div>
    <div style="margin-bottom:20px;">
      <label>Sword style</label>
      ${character.swordStyle ? `<span class="status-chip">${escapeHtml(character.swordStyle)} — ${escapeHtml(character.swordMastery || "Beginner")}</span>` : `<p style="color:var(--text-lo); font-size:12.5px;">None assigned yet — ask your Dice Master.</p>`}
    </div>
    <div style="margin-bottom:20px;">
      <label>Known spells</label>
      ${(character.knownSpells || []).length ? character.knownSpells.map((s) => `<span class="status-chip">${escapeHtml(s.name)} <span style="color:var(--text-lo);">(${escapeHtml(s.element)}, ${escapeHtml(s.tier)})</span></span>`).join("") : `<p style="color:var(--text-lo); font-size:12.5px;">None granted yet.</p>`}
    </div>
    <div>
      <label>Unlocked skills</label>
      ${unlocked.length ? unlocked.map((s) => `
        <div class="skill-card">
          <div class="skill-head"><strong>${escapeHtml(s.name)}</strong><span class="skill-tag" style="background:var(--mana)">${s.thresholdAttribute} ${s.thresholdValue}+</span></div>
          <p>${escapeHtml(s.description)}</p>
        </div>`).join("") : `<p style="color:var(--text-lo); font-size:12.5px;">Raise your attributes to unlock skills the Dice Master has set thresholds for.</p>`}
    </div>
  `;
}

async function renderNotesPanel(container) {
  if (!container) return;
  const allNotes = await DB.getDMNotes(room.id);
  const notes = allNotes.filter((n) => n.visibility === "public").sort((a, b) => b.createdAt - a.createdAt);
  container.innerHTML = notes.length
    ? notes.map((n) => `<div class="note-card">${escapeHtml(n.text)}<time>${new Date(n.createdAt).toLocaleString()}</time></div>`).join("")
    : `<p class="empty-state">The Dice Master hasn't posted any notes yet.</p>`;
}

async function renderDicePanel(container, character) {
  if (!container) return;
  container.innerHTML = "";
  const pending = await DB.getPendingDiceRequests(room.id, character.id);
  if (pending.length) {
    pending.forEach((req) => Dice.renderRequestCard(container, req, character));
  } else {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No roll has been requested yet.";
    container.appendChild(empty);
  }

  const allowed = canRoll();
  const freeRow = document.createElement("div");
  freeRow.className = "free-roll-row";
  freeRow.innerHTML = `
    <select id="freeRollSides-${container.id}" ${allowed ? "" : "disabled"}>
      <option value="4">d4</option>
      <option value="6">d6</option>
      <option value="8">d8</option>
      <option value="10">d10</option>
      <option value="12">d12</option>
      <option value="20" selected>d20</option>
      <option value="100">d100</option>
    </select>
    <button class="btn" id="freeRollBtn-${container.id}" ${allowed ? "" : "disabled"}>Roll for fun</button>
  `;
  container.appendChild(freeRow);
  if (!allowed && !isDM) {
    const lockNote = document.createElement("p");
    lockNote.className = "mini-note lock-note";
    lockNote.textContent = "The Dice Master hasn't opened the dice to you right now — wait for your turn or a roll request.";
    container.appendChild(lockNote);
  }
  document.getElementById(`freeRollBtn-${container.id}`).addEventListener("click", () => {
    if (!canRoll()) return;
    const sides = Number(document.getElementById(`freeRollSides-${container.id}`).value);
    Dice.freeRoll(sides, room.id, character);
  });
}

/* ==================================================================
 * Story feed / chat
 * ================================================================== */

async function renderStoryFeed() {
  const feed = document.getElementById("storyFeed");
  feed.innerHTML = "";
  const messages = await DB.getMessagesByRoom(room.id);
  for (const message of messages) {
    await appendStoryLine(message);
  }
  feed.scrollTop = feed.scrollHeight;
}

async function appendStoryLine(message) {
  const feed = document.getElementById("storyFeed");
  const line = document.createElement("div");
  line.className = `story-line ${message.type}`;
  if (message.type === "system") {
    line.innerHTML = `<span class="body">${escapeHtml(message.text)}</span>`;
  } else {
    const authorChar = message.authorId !== "system" ? await DB.getCharacter(message.authorId) : null;
    const nameClass = authorChar && authorChar.isDM ? "who dm-name" : "who";
    line.innerHTML = `<span class="${nameClass}">${escapeHtml(message.authorName)}</span><span class="body">${escapeHtml(message.text)}</span>`;
  }
  feed.appendChild(line);
  feed.scrollTop = feed.scrollHeight;
}

function wireComposer() {
  document.getElementById("composerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!canSpeak()) return;
    const input = document.getElementById("composerInput");
    const text = input.value.trim();
    if (!text) return;
    const msg = await DB.addMessage({
      roomId: room.id,
      authorId: myCharacter.id,
      authorName: myCharacter.name,
      type: "chat",
      text,
    });
    Sync.emit("chat:new", { message: msg });
    input.value = "";
  });

  document.getElementById("leaveBtn").addEventListener("click", () => {
    DB.clearSession();
    window.location.href = "index.html";
  });
}

/**
 * Locks/unlocks the composer input+button based on canSpeak(). The DM
 * is never locked out of their own table's chat.
 */
function refreshComposerLock() {
  const input = document.getElementById("composerInput");
  const form = document.getElementById("composerForm");
  if (!input || !form) return;
  const allowed = canSpeak();
  input.disabled = !allowed;
  form.querySelector("button[type=submit]").disabled = !allowed;
  input.placeholder = allowed
    ? "Say something to the table…"
    : isMyTurn()
      ? "Say something to the table…"
      : "Wait for your turn, or for the Dice Master to open the floor…";
}

/* ==================================================================
 * Table roster — everyone's name, DM click-to-set-turn
 * ================================================================== */

function wireRosterButton() {
  const btn = document.getElementById("rosterBtn");
  const dropdown = document.getElementById("rosterDropdown");
  btn.addEventListener("click", async () => {
    const willOpen = dropdown.classList.contains("hidden");
    dropdown.classList.toggle("hidden");
    if (willOpen) await renderRoster();
  });
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  });
}

async function renderRoster() {
  const dropdown = document.getElementById("rosterDropdown");
  if (!dropdown) return;
  const chars = await DB.getCharactersByRoom(room.id);
  const rows = chars.filter((c) => c.built).map((c) => {
    const onTurn = room.activeCharacterId === c.id;
    return `
      <button class="roster-row ${onTurn ? "on-turn" : ""}" data-cid="${c.id}" ${isDM ? "" : "disabled"}>
        <span class="roster-dot ${onTurn ? "lit" : ""}"></span>
        <span class="roster-name">${escapeHtml(c.name)}${c.isDM ? " (DM)" : ""}</span>
      </button>`;
  }).join("");

  dropdown.innerHTML = `
    <div class="roster-head">Table roster</div>
    ${rows || `<p class="empty-state">No one has taken a seat yet.</p>`}
    ${isDM ? `
      <div class="roster-head roster-controls-head">Table controls</div>
      <label class="roster-toggle-row">
        <input type="checkbox" id="chatUnlockToggle" ${room.chatUnlocked ? "checked" : ""} />
        Open chat to everyone
      </label>
      <label class="roster-toggle-row">
        <input type="checkbox" id="rollUnlockToggle" ${room.rollUnlocked ? "checked" : ""} />
        Open dice to everyone
      </label>
    ` : ""}
  `;

  if (isDM) {
    dropdown.querySelectorAll(".roster-row[data-cid]").forEach((row) => {
      row.addEventListener("click", async () => {
        const cid = row.dataset.cid;
        const next = room.activeCharacterId === cid ? null : cid;
        room = await DB.setRoomTurn(room.id, next);
        Sync.emit("turn:update", { activeCharacterId: next });
        renderRoster();
        refreshComposerLock();
      });
    });
    document.getElementById("chatUnlockToggle").addEventListener("change", async (e) => {
      room = await DB.setChatUnlocked(room.id, e.target.checked);
      Sync.emit("chat:lock", { chatUnlocked: e.target.checked });
      refreshComposerLock();
    });
    document.getElementById("rollUnlockToggle").addEventListener("change", async (e) => {
      room = await DB.setRollUnlocked(room.id, e.target.checked);
      Sync.emit("roll:lock", { rollUnlocked: e.target.checked });
    });
  }
}

/* ==================================================================
 * Live updates from other tabs (DM tools, other players)
 * ================================================================== */

function wireSyncListeners() {
  Sync.on("chat:new", ({ message }) => {
    if (message.roomId !== room.id) return;
    appendStoryLine(message);
  });

  Sync.on("character:update", ({ character }) => {
    if (character.roomId !== room.id) return;
    if (character.id === myCharacter.id) myCharacter = character;
    // Refresh whichever panel(s) currently show this character.
    if (character.id === myCharacter.id) {
      const prefix = isDM ? "left" : "player";
      renderPlayerTabs(prefix, character);
    }
    if (isDM) DMTools.onCharacterUpdate(character);
  });

  Sync.on("dice:request", ({ request }) => {
    if (request.roomId !== room.id || request.targetCharacterId !== myCharacter.id) return;
    const prefix = isDM ? "left" : "player";
    const panel = document.getElementById(`${prefix}DicePanel`);
    if (panel) renderDicePanel(panel, myCharacter);
  });

  Sync.on("dice:result", () => {
    const prefix = isDM ? "left" : "player";
    const panel = document.getElementById(`${prefix}DicePanel`);
    if (panel) renderDicePanel(panel, myCharacter);
  });

  Sync.on("note:public", () => {
    const prefix = isDM ? "left" : "player";
    const panel = document.getElementById(`${prefix}NotesPanel`);
    if (panel) renderNotesPanel(panel);
  });

  Sync.on("skill:new", () => {
    const prefix = isDM ? "left" : "player";
    const panel = document.getElementById(`${prefix}ConditionPanel`);
    if (panel) renderConditionPanel(panel, myCharacter);
    if (isDM && typeof DMTools !== "undefined" && DMTools.refreshSkillLib) DMTools.refreshSkillLib();
  });

  Sync.on("turn:update", ({ activeCharacterId }) => {
    room.activeCharacterId = activeCharacterId;
    refreshComposerLock();
    renderRoster();
    const prefix = isDM ? "left" : "player";
    const dicePanel = document.getElementById(`${prefix}DicePanel`);
    if (dicePanel) renderDicePanel(dicePanel, myCharacter);
  });

  Sync.on("chat:lock", ({ chatUnlocked }) => {
    room.chatUnlocked = chatUnlocked;
    refreshComposerLock();
    renderRoster();
  });

  Sync.on("roll:lock", ({ rollUnlocked }) => {
    room.rollUnlocked = rollUnlocked;
    renderRoster();
    const prefix = isDM ? "left" : "player";
    const dicePanel = document.getElementById(`${prefix}DicePanel`);
    if (dicePanel) renderDicePanel(dicePanel, myCharacter);
  });
}

// dm-tools.js loads after this file but defines DMTools before any DOM
// content is ready, so it's safe to boot once parsing finishes.
document.addEventListener("DOMContentLoaded", boot);
