/**
 * dm-tools.js — the Dice Master's right-side control panel: private
 * notes, event triggers (status effects), live stat/HP edits, inventory
 * management, forcing rolls, and defining custom skills with attribute
 * thresholds. Every write here goes through DB then Sync.emit(...) so
 * the affected player's screen updates immediately (see sync.js).
 */

const DMTools = (() => {
  let roomRef;

  const TUTORIAL_SECTIONS = [
    {
      title: "The basics: pick a target, then act",
      body: `Almost every tab has a dropdown at the top ("Adjust a player", "Apply a status effect", etc). That dropdown is who your next action applies to. Pick the player first, then use the fields below it — nothing you do on these tabs affects anyone except whoever is currently selected in that tab's dropdown.`,
    },
    {
      title: "Overview — see everything about a player at once",
      body: `The first tab. Pick a player and you'll see their HP, all seven attributes, status effects, inventory, sword style + mastery, known spells, and any skills they've unlocked — all in one read-only card. Use this to quickly check where someone stands before deciding what to do to them. To actually change any of it, use the specific tab for that thing (see below).`,
    },
    {
      title: "Notes — talk to yourself or the table",
      body: `Write a note and choose Private (only you ever see it — good for planning ahead) or Public (posted to every player's "DM Notes" tab immediately). Good for foreshadowing, reminders, or an in-character whisper you want on record.`,
    },
    {
      title: "Events — apply or remove status effects",
      body: `Pick a player, type a status name (Burned, Stunned, Blessed — anything you want, it's free text), and hit Apply. It shows up as a chip on their Condition tab immediately and posts to the story feed. Click the × on a chip here to remove it.`,
    },
    {
      title: "Stats & HP — adjust attributes and health live",
      body: `Pick a player, then use the +/− steppers to change any of their seven attributes (capped at ${GameData.attributeCap} each), or type new HP current/max values directly. Hit "Save changes" to push it live — their stat bars and HP bar update instantly on their screen.`,
    },
    {
      title: "Inventory — give or take items",
      body: `Pick a player, type an item name and quantity, hit Add. Adding an item they already have increases the stack instead of duplicating it. Click Remove next to any item to take it away entirely.`,
    },
    {
      title: "Classes — this is how you assign sword styles and spells",
      body: `This is the tab your friend was missing. "Sword styles" and "spells" are reference material everywhere else in the app (Spellbook, Skill Lib) — they don't attach to anyone until you do it here.
      <br><br><strong>Sword style:</strong> pick a player, pick one of the four styles and a mastery level (Beginner through God), hit "Set sword style." A player can only hold one active style at a time — picking a new one replaces the old.
      <br><br><strong>Spells:</strong> pick an element and tier, pick the specific spell from the dropdown that fills in below, hit Grant. It's now permanently listed under that player's "known spells" — visible to you on Overview and to them on their own Condition tab. Click the × on a spell chip here to make them forget it.`,
    },
    {
      title: "Skills — define attribute thresholds that auto-unlock",
      body: `This is different from Classes. A "skill" here isn't granted to one player directly — instead you define a rule ("Stealth 8+ unlocks Wind Cutters") once, and it applies to the whole table automatically: any player whose Stealth reaches 8 sees it appear on their own Condition tab with no further action from you. Use this for abilities that should reward raising a stat, rather than a one-off item you hand to a specific person.`,
    },
    {
      title: "Dice — force a roll",
      body: `Pick a player, a die size, and an optional reason ("Stealth check"), hit "Send roll request." It appears on that player's Dice tab immediately; once they roll, the result posts to the story feed automatically. This works regardless of whose turn it is or whether chat/dice are locked — a DM request always gets through.`,
    },
    {
      title: "Spells & Skill Lib — read-only reference",
      body: `Spells lets you browse and filter the full spell list by element/tier/name. Skill Lib shows the intellectual skills, sword style descriptions, and the mastery ladder, plus the custom skills you've defined. Neither of these tabs changes anything about a player by itself — use Classes (for spells/sword style) or Skills (for thresholds) to actually apply them.`,
    },
    {
      title: "The \"Table\" button — turns, chat, and dice locks",
      body: `Up in the top bar, the "Table" button (next to your role pill) shows every player. Click a name to make it their turn — that unlocks the chat box and free dice roll just for them, shown with a green dot. Click the same name again to clear the turn for everyone. The two checkboxes below the roster ("Open chat to everyone" / "Open dice to everyone") bypass turns entirely if you want a free-for-all moment.`,
    },
  ];

  function tutorialHtml() {
    return TUTORIAL_SECTIONS.map((s) => `
      <div class="tutorial-section">
        <h4>${escapeHtml(s.title)}</h4>
        <p>${s.body}</p>
      </div>
    `).join("");
  }

  function wireTutorial() {
    const btn = document.getElementById("dmTutorialBtn");
    const overlay = document.getElementById("tutorialModal");
    const card = document.getElementById("tutorialModalCard");
    if (!btn || !overlay || !card) return;

    btn.classList.remove("hidden");
    btn.onclick = () => {
      card.innerHTML = `
        <div class="modal-head">
          <h3>Dice Master tutorial</h3>
          <button class="btn btn-ghost" id="tutorialCloseBtn">✕</button>
        </div>
        <div class="modal-body">${tutorialHtml()}</div>
      `;
      overlay.classList.remove("hidden");
      document.getElementById("tutorialCloseBtn").addEventListener("click", () => {
        overlay.classList.add("hidden");
      });
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.add("hidden");
    });
  }

  async function render(tabBar, panels, room) {
    roomRef = room;
    tabBar.innerHTML = `
      <button data-tab="overview" class="active">Overview</button>
      <button data-tab="notes">Notes</button>
      <button data-tab="events">Events</button>
      <button data-tab="stats">Stats & HP</button>
      <button data-tab="inventory">Inventory</button>
      <button data-tab="classes">Classes</button>
      <button data-tab="skills">Skills</button>
      <button data-tab="dice">Dice</button>
      <button data-tab="spellbook">Spells</button>
      <button data-tab="skilllib">Skill Lib</button>
    `;
    panels.innerHTML = `
      <div class="tab-panel active" data-panel="overview" id="dmOverviewTab"></div>
      <div class="tab-panel" data-panel="notes" id="dmNotesTab"></div>
      <div class="tab-panel" data-panel="events" id="dmEventsTab"></div>
      <div class="tab-panel" data-panel="stats" id="dmStatsTab"></div>
      <div class="tab-panel" data-panel="inventory" id="dmInventoryTab"></div>
      <div class="tab-panel" data-panel="classes" id="dmClassesTab"></div>
      <div class="tab-panel" data-panel="skills" id="dmSkillsTab"></div>
      <div class="tab-panel" data-panel="dice" id="dmDiceTab"></div>
      <div class="tab-panel" data-panel="spellbook" id="dmSpellbookTab"></div>
      <div class="tab-panel" data-panel="skilllib" id="dmSkillLibTab"></div>
    `;
    wireTabBar(tabBar, document.getElementById("rightSidebar"));

    await Promise.all([
      renderOverviewTab(),
      renderNotesTab(),
      renderEventsTab(),
      renderStatsTab(),
      renderInventoryTab(),
      renderClassesTab(),
      renderSkillsTab(),
      renderDiceTab(),
      renderSpellbookTab(),
      renderSkillLibTab(),
    ]);

    wireTutorial();
  }

  function characters() {
    return DB.getCharactersByRoom(roomRef.id);
  }

  async function targetSelectHtml(id) {
    const opts = (await characters())
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}${c.isDM ? " (you)" : ""}</option>`)
      .join("");
    return `<select id="${id}">${opts || "<option disabled>No characters yet</option>"}</select>`;
  }

  function currentTarget(selectId) {
    const id = document.getElementById(selectId).value;
    return DB.getCharacter(id);
  }

  async function announce(text) {
    const msg = await DB.addMessage({ roomId: roomRef.id, authorId: "system", authorName: "System", type: "system", text });
    Sync.emit("chat:new", { message: msg });
  }

  async function pushCharacterUpdate(character) {
    const saved = await DB.upsertCharacter(character);
    Sync.emit("character:update", { character: saved });
    return saved;
  }

  /* --------------------------------------------------------- Overview
   * Read-only "everything about this player at a glance" card: HP,
   * every stat, status effects, inventory, sword style/mastery, known
   * spells, and any unlocked skills — the whole character sheet in one
   * place instead of hunting across six tabs.
   */
  async function renderOverviewTab() {
    const el = document.getElementById("dmOverviewTab");
    el.innerHTML = `
      <div class="dm-section">
        <h3>Player at a glance</h3>
        <div class="dm-target-picker">${await targetSelectHtml("overviewTarget")}</div>
        <div id="overviewBody"></div>
      </div>
    `;
    document.getElementById("overviewTarget").addEventListener("change", renderOverviewBody);
    renderOverviewBody();
  }

  async function renderOverviewBody() {
    const body = document.getElementById("overviewBody");
    const target = await currentTarget("overviewTarget");
    if (!target) return (body.innerHTML = `<p class="empty-state">No characters yet.</p>`);

    const hpPct = Math.max(0, Math.min(100, (target.hp.current / target.hp.max) * 100));
    const customSkills = await DB.getCustomSkills(roomRef.id);
    const unlocked = customSkills.filter((s) => (target.stats[s.thresholdAttribute] || 0) >= s.thresholdValue);
    const knownSpells = target.knownSpells || [];

    body.innerHTML = `
      <div class="overview-name">${escapeHtml(target.name)}${target.isDM ? " (you)" : ""}</div>

      <div class="hp-block">
        <div class="hp-numbers"><span>HP</span><span>${target.hp.current} / ${target.hp.max}</span></div>
        <div class="hp-track"><div class="hp-fill" style="width:${hpPct}%"></div></div>
      </div>

      <label>Attributes</label>
      ${GameData.attributes.map((attr) => {
        const val = target.stats[attr] || 0;
        return `<div class="stat-row">
          <span class="stat-name">${attr}</span>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${(val / GameData.attributeCap) * 100}%; background:${STAT_COLORS[attr] || "var(--gold)"}"></div></div>
          <span class="stat-val">${val}</span>
        </div>`;
      }).join("")}

      <label style="margin-top:14px;">Status effects</label>
      <div style="margin-bottom:16px;">
        ${target.statusEffects.length ? target.statusEffects.map((s) => `<span class="status-chip">${escapeHtml(s)}</span>`).join("") : `<span style="color:var(--text-lo); font-size:12.5px;">None active</span>`}
      </div>

      <label>Inventory</label>
      <div style="margin-bottom:16px;">
        ${target.inventory.length ? target.inventory.map((i) => `<div class="inventory-item"><span>${escapeHtml(i.name)}</span><span class="qty">×${i.qty}</span></div>`).join("") : `<p style="color:var(--text-lo); font-size:12.5px; margin:0;">Empty.</p>`}
      </div>

      <label>Sword style</label>
      <div style="margin-bottom:16px;">
        ${target.swordStyle ? `<span class="status-chip">${escapeHtml(target.swordStyle)} — ${escapeHtml(target.swordMastery || "Beginner")}</span>` : `<span style="color:var(--text-lo); font-size:12.5px;">None assigned — set one on the Classes tab.</span>`}
      </div>

      <label>Known spells</label>
      <div style="margin-bottom:16px;">
        ${knownSpells.length ? knownSpells.map((s) => `<span class="status-chip">${escapeHtml(s.name)} <span style="color:var(--text-lo);">(${escapeHtml(s.element)}, ${escapeHtml(s.tier)})</span></span>`).join("") : `<span style="color:var(--text-lo); font-size:12.5px;">None granted — use the Classes tab.</span>`}
      </div>

      <label>Unlocked skills</label>
      <div>
        ${unlocked.length ? unlocked.map((s) => `
          <div class="skill-card">
            <div class="skill-head"><strong>${escapeHtml(s.name)}</strong><span class="skill-tag" style="background:var(--mana)">${s.thresholdAttribute} ${s.thresholdValue}+</span></div>
            <p>${escapeHtml(s.description)}</p>
          </div>`).join("") : `<p class="empty-state">None yet — either raise an attribute past a threshold, or define one on the Skills tab.</p>`}
      </div>
    `;
  }

  /* ---------------------------------------------------------- Notes */
  async function renderNotesTab() {
    const el = document.getElementById("dmNotesTab");
    const allNotes = await DB.getDMNotes(roomRef.id);
    const notes = allNotes.sort((a, b) => b.createdAt - a.createdAt);
    el.innerHTML = `
      <div class="dm-section">
        <h3>Write a note</h3>
        <textarea class="notes-box" id="dmNoteText" placeholder="Story progression, future plans, a whisper to the table…"></textarea>
        <div class="dm-field-row" style="margin-top:8px;">
          <select id="dmNoteVisibility">
            <option value="private">Private (DM only)</option>
            <option value="public">Public (visible to players)</option>
          </select>
          <button class="btn btn-primary" id="dmNoteSaveBtn">Save note</button>
        </div>
      </div>
      <div class="dm-section">
        <h3>Note log</h3>
        ${notes.length ? notes.map((n) => `
          <div class="note-card" style="border-left-color:${n.visibility === "public" ? "var(--mana)" : "var(--text-lo)"}">
            <strong style="font-size:11px; text-transform:uppercase; letter-spacing:.03em; color:${n.visibility === "public" ? "var(--mana)" : "var(--text-lo)"}">${n.visibility}</strong>
            <div>${escapeHtml(n.text)}</div>
            <time>${new Date(n.createdAt).toLocaleString()}</time>
          </div>`).join("") : `<p class="empty-state">No notes yet.</p>`}
      </div>
    `;
    document.getElementById("dmNoteSaveBtn").addEventListener("click", async () => {
      const text = document.getElementById("dmNoteText").value.trim();
      if (!text) return;
      const visibility = document.getElementById("dmNoteVisibility").value;
      const note = await DB.addDMNote({ roomId: roomRef.id, authorId: roomRef.dmUserId, text, visibility });
      if (visibility === "public") Sync.emit("note:public", { note });
      renderNotesTab();
    });
  }

  /* --------------------------------------------------------- Events */
  async function renderEventsTab() {
    const el = document.getElementById("dmEventsTab");
    el.innerHTML = `
      <div class="dm-section">
        <h3>Apply a status effect</h3>
        <div class="dm-target-picker">${await targetSelectHtml("eventsTarget")}</div>
        <div class="dm-field-row">
          <input id="eventEffectName" placeholder="e.g. Burned, Stunned, Blessed" />
          <button class="btn btn-primary" id="eventApplyBtn">Apply</button>
        </div>
        <div id="eventsCurrentStatuses" style="margin-top:12px;"></div>
      </div>
    `;
    document.getElementById("eventsTarget").addEventListener("change", renderEventCurrentStatuses);
    renderEventCurrentStatuses();

    document.getElementById("eventApplyBtn").addEventListener("click", async () => {
      const name = document.getElementById("eventEffectName").value.trim();
      if (!name) return;
      const target = await currentTarget("eventsTarget");
      target.statusEffects.push(name);
      await pushCharacterUpdate(target);
      announce(`${target.name} is now ${name}.`);
      document.getElementById("eventEffectName").value = "";
      renderEventCurrentStatuses();
    });
  }

  async function renderEventCurrentStatuses() {
    const box = document.getElementById("eventsCurrentStatuses");
    const target = await currentTarget("eventsTarget");
    if (!target) return (box.innerHTML = "");
    box.innerHTML = `<label>Active on ${escapeHtml(target.name)}</label>` +
      (target.statusEffects.length
        ? target.statusEffects.map((s, i) => `<span class="status-chip">${escapeHtml(s)} <button data-i="${i}">×</button></span>`).join("")
        : `<span style="color:var(--text-lo); font-size:12.5px;">None</span>`);
    box.querySelectorAll("button[data-i]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const i = Number(btn.dataset.i);
        const removed = target.statusEffects.splice(i, 1)[0];
        await pushCharacterUpdate(target);
        announce(`${target.name} is no longer ${removed}.`);
        renderEventCurrentStatuses();
      });
    });
  }

  /* ----------------------------------------------------- Stats & HP */
  async function renderStatsTab() {
    const el = document.getElementById("dmStatsTab");
    el.innerHTML = `
      <div class="dm-section">
        <h3>Adjust a player</h3>
        <div class="dm-target-picker">${await targetSelectHtml("statsTarget")}</div>
        <div id="statsEditorBody"></div>
      </div>
    `;
    document.getElementById("statsTarget").addEventListener("change", renderStatsEditorBody);
    renderStatsEditorBody();
  }

  async function renderStatsEditorBody() {
    const body = document.getElementById("statsEditorBody");
    const target = await currentTarget("statsTarget");
    if (!target) return (body.innerHTML = "");
    body.innerHTML = `
      ${GameData.attributes.map((attr) => `
        <div class="stat-editor-row">
          <span class="stat-name">${attr}</span>
          <div class="stepper">
            <button type="button" data-attr="${attr}" data-dir="-1">−</button>
            <span class="val" id="dmval-${attr}">${target.stats[attr]}</span>
            <button type="button" data-attr="${attr}" data-dir="1">+</button>
          </div>
        </div>`).join("")}
      <div class="dm-field-row" style="margin-top:14px;">
        <div>
          <label>HP current</label>
          <input type="number" id="dmHpCurrent" value="${target.hp.current}" min="0" max="${target.hp.max}" />
        </div>
        <div>
          <label>HP max</label>
          <input type="number" id="dmHpMax" value="${target.hp.max}" min="1" />
        </div>
      </div>
      <button class="btn btn-primary btn-block" id="dmStatsSaveBtn" style="margin-top:12px;">Save changes</button>
    `;
    body.querySelectorAll("button[data-attr]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const attr = btn.dataset.attr;
        const dir = Number(btn.dataset.dir);
        const next = target.stats[attr] + dir;
        if (next < 0 || next > GameData.attributeCap) return;
        target.stats[attr] = next;
        document.getElementById(`dmval-${attr}`).textContent = next;
      });
    });
    document.getElementById("dmStatsSaveBtn").addEventListener("click", async () => {
      target.hp.max = Math.max(1, Number(document.getElementById("dmHpMax").value) || target.hp.max);
      target.hp.current = Math.min(target.hp.max, Math.max(0, Number(document.getElementById("dmHpCurrent").value) || 0));
      await pushCharacterUpdate(target);
      announce(`${target.name}'s stats were updated by the Dice Master.`);
    });
  }

  /* ------------------------------------------------------- Inventory */
  async function renderInventoryTab() {
    const el = document.getElementById("dmInventoryTab");
    el.innerHTML = `
      <div class="dm-section">
        <h3>Manage inventory</h3>
        <div class="dm-target-picker">${await targetSelectHtml("invTarget")}</div>
        <div class="dm-field-row">
          <input id="invItemName" placeholder="Item name" />
          <input id="invItemQty" type="number" value="1" min="1" style="max-width:70px;" />
          <button class="btn btn-primary" id="invAddBtn">Add</button>
        </div>
        <div id="invList" style="margin-top:12px;"></div>
      </div>
    `;
    document.getElementById("invTarget").addEventListener("change", renderInvList);
    renderInvList();

    document.getElementById("invAddBtn").addEventListener("click", async () => {
      const name = document.getElementById("invItemName").value.trim();
      const qty = Math.max(1, Number(document.getElementById("invItemQty").value) || 1);
      if (!name) return;
      const target = await currentTarget("invTarget");
      const existing = target.inventory.find((i) => i.name.toLowerCase() === name.toLowerCase());
      if (existing) existing.qty += qty;
      else target.inventory.push({ name, qty });
      await pushCharacterUpdate(target);
      announce(`${target.name} received ${qty}× ${name}.`);
      document.getElementById("invItemName").value = "";
      renderInvList();
    });
  }

  async function renderInvList() {
    const box = document.getElementById("invList");
    const target = await currentTarget("invTarget");
    if (!target) return (box.innerHTML = "");
    box.innerHTML = target.inventory.length
      ? target.inventory.map((i, idx) => `
        <div class="inventory-item">
          <span>${escapeHtml(i.name)} <span class="qty">×${i.qty}</span></span>
          <button class="btn btn-ghost" data-idx="${idx}" style="padding:2px 8px;">Remove</button>
        </div>`).join("")
      : `<p class="empty-state">No items yet.</p>`;
    box.querySelectorAll("button[data-idx]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const removed = target.inventory.splice(Number(btn.dataset.idx), 1)[0];
        await pushCharacterUpdate(target);
        announce(`${removed.name} was removed from ${target.name}'s inventory.`);
        renderInvList();
      });
    });
  }

  /* ------------------------------------------------------------ Classes
   * This is where sword styles and spells actually get attached to a
   * player — the Spellbook and Skill Lib tabs are reference-only, this
   * tab is the "apply it to someone" step.
   */
  async function renderClassesTab() {
    const el = document.getElementById("dmClassesTab");
    el.innerHTML = `
      <div class="dm-section">
        <h3>Assign a sword style</h3>
        <div class="dm-target-picker">${await targetSelectHtml("classesTarget")}</div>
        <div class="dm-field-row">
          <select id="classSwordStyle">
            <option value="">— none —</option>
            ${GameData.swordStyles.map((s) => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join("")}
          </select>
          <select id="classSwordMastery">
            ${GameData.swordMasteryLevels.map((m) => `<option value="${m}">${m}</option>`).join("")}
          </select>
        </div>
        <button class="btn btn-primary btn-block" id="classSwordSaveBtn" style="margin-top:8px;">Set sword style</button>
        <p class="mini-note">This replaces whatever style/mastery the player currently has — it's their one active style, per the mastery ladder in the Skill Lib tab.</p>
        <div id="classCurrentStyle" style="margin-top:12px;"></div>
      </div>

      <div class="dm-section">
        <h3>Grant a spell</h3>
        <div class="dm-field-row">
          <select id="classSpellElement">
            ${Object.keys(GameData.magic).map((k) => `<option value="${k}">${GameData.magic[k].label}</option>`).join("")}
          </select>
          <select id="classSpellTier">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="unique">Unique</option>
            <option value="ultimate">Ultimate</option>
          </select>
        </div>
        <div class="dm-field-row">
          <select id="classSpellName"></select>
          <button class="btn btn-primary" id="classSpellGrantBtn">Grant</button>
        </div>
        <p class="mini-note">Browse full descriptions on the Spells tab first if you're not sure which one fits — this just attaches the spell you pick to the selected player.</p>
        <label style="margin-top:14px;">Spells this player already knows</label>
        <div id="classKnownSpells"></div>
      </div>
    `;

    function refreshSpellNameOptions() {
      const element = document.getElementById("classSpellElement").value;
      const tier = document.getElementById("classSpellTier").value;
      const spells = (GameData.magic[element] && GameData.magic[element].tiers[tier]) || [];
      const nameSelect = document.getElementById("classSpellName");
      nameSelect.innerHTML = spells.length
        ? spells.map((s) => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join("")
        : `<option disabled>No spells at this tier</option>`;
    }
    document.getElementById("classSpellElement").addEventListener("change", refreshSpellNameOptions);
    document.getElementById("classSpellTier").addEventListener("change", refreshSpellNameOptions);
    refreshSpellNameOptions();

    document.getElementById("classesTarget").addEventListener("change", renderClassesBody);
    renderClassesBody();

    document.getElementById("classSwordSaveBtn").addEventListener("click", async () => {
      const target = await currentTarget("classesTarget");
      const style = document.getElementById("classSwordStyle").value;
      const mastery = document.getElementById("classSwordMastery").value;
      target.swordStyle = style || null;
      target.swordMastery = style ? mastery : null;
      await pushCharacterUpdate(target);
      announce(style
        ? `${target.name} was set to ${style} (${mastery}).`
        : `${target.name}'s sword style was cleared.`);
      renderClassesBody();
    });

    document.getElementById("classSpellGrantBtn").addEventListener("click", async () => {
      const target = await currentTarget("classesTarget");
      const element = document.getElementById("classSpellElement").value;
      const tier = document.getElementById("classSpellTier").value;
      const name = document.getElementById("classSpellName").value;
      if (!name) return;
      target.knownSpells = target.knownSpells || [];
      if (target.knownSpells.some((s) => s.name === name)) return;
      target.knownSpells.push({ name, element, tier });
      await pushCharacterUpdate(target);
      announce(`${target.name} learned ${name}.`);
      renderClassesBody();
    });
  }

  async function renderClassesBody() {
    const target = await currentTarget("classesTarget");
    const styleBox = document.getElementById("classCurrentStyle");
    const knownBox = document.getElementById("classKnownSpells");
    if (!target) {
      styleBox.innerHTML = "";
      knownBox.innerHTML = "";
      return;
    }
    document.getElementById("classSwordStyle").value = target.swordStyle || "";
    document.getElementById("classSwordMastery").value = target.swordMastery || "Beginner";
    styleBox.innerHTML = target.swordStyle
      ? `<label>Current style</label><span class="status-chip">${escapeHtml(target.swordStyle)} — ${escapeHtml(target.swordMastery || "Beginner")}</span>`
      : `<label>Current style</label><span style="color:var(--text-lo); font-size:12.5px;">None assigned yet.</span>`;

    const known = target.knownSpells || [];
    knownBox.innerHTML = known.length
      ? known.map((s, idx) => `<span class="status-chip">${escapeHtml(s.name)} <button data-idx="${idx}">×</button></span>`).join("")
      : `<span style="color:var(--text-lo); font-size:12.5px;">None granted yet.</span>`;
    knownBox.querySelectorAll("button[data-idx]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const removed = target.knownSpells.splice(Number(btn.dataset.idx), 1)[0];
        await pushCharacterUpdate(target);
        announce(`${target.name} forgot ${removed.name}.`);
        renderClassesBody();
      });
    });
  }

  /* ------------------------------------------------------------ Dice */
  async function renderDiceTab() {
    const el = document.getElementById("dmDiceTab");
    el.innerHTML = `
      <div class="dm-section">
        <h3>Force a roll</h3>
        <div class="dm-target-picker">${await targetSelectHtml("diceTarget")}</div>
        <div class="dm-field-row">
          <select id="diceSides">
            <option value="4">d4</option><option value="6">d6</option><option value="8">d8</option>
            <option value="10">d10</option><option value="12">d12</option>
            <option value="20" selected>d20</option><option value="100">d100</option>
          </select>
          <input id="diceLabel" placeholder="Reason (optional) — e.g. Stealth check" />
        </div>
        <button class="btn btn-primary btn-block" id="diceRequestBtn" style="margin-top:10px;">Send roll request</button>
        <p class="mini-note">The die appears on that player's Dice tab immediately, and the result posts to the story feed once they roll.</p>
      </div>
    `;
    document.getElementById("diceRequestBtn").addEventListener("click", async () => {
      const target = await currentTarget("diceTarget");
      const sides = Number(document.getElementById("diceSides").value);
      const label = document.getElementById("diceLabel").value.trim();
      const request = await DB.createDiceRequest({ roomId: roomRef.id, targetCharacterId: target.id, requestedBy: roomRef.dmUserId, sides, label });
      Sync.emit("dice:request", { request, characterId: target.id });
      announce(`The Dice Master requested a d${sides} roll from ${target.name}${label ? ` (${label})` : ""}.`);
    });
  }

  /* ---------------------------------------------------------- Skills */
  async function renderSkillsTab() {
    const el = document.getElementById("dmSkillsTab");
    const allSkills = await DB.getCustomSkills(roomRef.id);
    const skills = allSkills.sort((a, b) => b.createdAt - a.createdAt);
    el.innerHTML = `
      <div class="dm-section">
        <h3>Create a skill / threshold</h3>
        <input id="skillName" placeholder="Skill or spell name" style="margin-bottom:8px;" />
        <textarea class="notes-box" id="skillDesc" placeholder="What it does" style="min-height:60px; margin-bottom:8px;"></textarea>
        <div class="dm-field-row">
          <select id="skillAttr">${GameData.attributes.map((a) => `<option value="${a}">${a}</option>`).join("")}</select>
          <input id="skillThreshold" type="number" min="0" max="${GameData.attributeCap}" value="5" />
        </div>
        <button class="btn btn-primary btn-block" id="skillSaveBtn" style="margin-top:10px;">Add skill</button>
        <p class="mini-note">Any player whose attribute meets the threshold sees this skill unlock automatically on their Condition tab.</p>
      </div>
      <div class="dm-section">
        <h3>Reference library</h3>
        <p class="mini-note">The full Quevela spell list, items, sword styles, and lore are seeded from DM_info.pdf — browse them anytime with <code>GameData</code> in the console, or extend this tab to surface them in the UI.</p>
      </div>
      <div class="dm-section">
        <h3>Custom skills so far</h3>
        ${skills.length ? skills.map((s) => `
          <div class="skill-card">
            <div class="skill-head"><strong>${escapeHtml(s.name)}</strong><span class="skill-tag" style="background:var(--mana)">${s.thresholdAttribute} ${s.thresholdValue}+</span></div>
            <p>${escapeHtml(s.description)}</p>
          </div>`).join("") : `<p class="empty-state">None yet.</p>`}
      </div>
    `;
    document.getElementById("skillSaveBtn").addEventListener("click", async () => {
      const name = document.getElementById("skillName").value.trim();
      const description = document.getElementById("skillDesc").value.trim();
      const thresholdAttribute = document.getElementById("skillAttr").value;
      const thresholdValue = document.getElementById("skillThreshold").value;
      if (!name) return;
      const skill = await DB.addCustomSkill({ roomId: roomRef.id, name, description, thresholdAttribute, thresholdValue });
      Sync.emit("skill:new", { skill });
      renderSkillsTab();
    });
  }

  /* ------------------------------------------------------ Spellbook
   * DM-only reference browser over GameData.magic — the full Fire /
   * Water / Wind / Earth / Intellectual spell library seeded from
   * DM_info.pdf, filterable by element and tier so the DM can look
   * something up mid-session without leaving the sidebar.
   */
  async function renderSpellbookTab() {
    const el = document.getElementById("dmSpellbookTab");
    const elements = Object.keys(GameData.magic);
    el.innerHTML = `
      <div class="dm-section">
        <h3>Spellbook</h3>
        <div class="dm-field-row">
          <select id="spellElementFilter">
            <option value="all">All elements</option>
            ${elements.map((k) => `<option value="${k}">${GameData.magic[k].label}</option>`).join("")}
          </select>
          <select id="spellTierFilter">
            <option value="all">All tiers</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="unique">Unique</option>
            <option value="ultimate">Ultimate</option>
          </select>
        </div>
        <input id="spellSearch" placeholder="Search spell names…" style="margin-bottom:8px;" />
        <div id="spellList"></div>
      </div>
    `;
    document.getElementById("spellElementFilter").addEventListener("change", renderSpellList);
    document.getElementById("spellTierFilter").addEventListener("change", renderSpellList);
    document.getElementById("spellSearch").addEventListener("input", renderSpellList);
    renderSpellList();
  }

  function renderSpellList() {
    const box = document.getElementById("spellList");
    if (!box) return;
    const elFilter = document.getElementById("spellElementFilter").value;
    const tierFilter = document.getElementById("spellTierFilter").value;
    const search = document.getElementById("spellSearch").value.trim().toLowerCase();

    const elementKeys = elFilter === "all" ? Object.keys(GameData.magic) : [elFilter];
    const tierKeys = tierFilter === "all" ? ["beginner", "intermediate", "advanced", "unique", "ultimate"] : [tierFilter];

    let cards = "";
    elementKeys.forEach((ek) => {
      const element = GameData.magic[ek];
      if (!element) return;
      tierKeys.forEach((tk) => {
        const spells = element.tiers[tk] || [];
        spells.forEach((s) => {
          if (search && !s.name.toLowerCase().includes(search)) return;
          cards += `
            <div class="skill-card">
              <div class="skill-head">
                <strong>${escapeHtml(s.name)}</strong>
                <span class="skill-tag" style="background:var(--${ek})">${element.label} · ${tk}${s.subCategory ? " · sub" : ""}</span>
              </div>
              <p>${escapeHtml(s.desc)}</p>
            </div>`;
        });
      });
    });
    box.innerHTML = cards || `<p class="empty-state">No spells match that filter.</p>`;
  }

  /* ------------------------------------------------------ Skill Library
   * DM-only reference browser over the static intellectual skills and
   * sword styles from GameData, plus the room's live custom-skill list
   * (same data already shown on the Skills tab, surfaced here too for
   * quick lookup without switching tabs mid-scene).
   */
  async function renderSkillLibTab() {
    const el = document.getElementById("dmSkillLibTab");
    const allSkills = await DB.getCustomSkills(roomRef.id);
    const custom = allSkills.sort((a, b) => b.createdAt - a.createdAt);

    el.innerHTML = `
      <div class="dm-section">
        <h3>Intellectual skills</h3>
        ${GameData.intellectualSkills.map((s) => `
          <div class="skill-card">
            <div class="skill-head"><strong>${escapeHtml(s.name)}</strong></div>
            <p>${escapeHtml(s.desc)}</p>
          </div>`).join("")}
      </div>
      <div class="dm-section">
        <h3>Sword styles</h3>
        ${GameData.swordStyles.map((s) => `
          <div class="skill-card">
            <div class="skill-head"><strong>${escapeHtml(s.name)}</strong><span class="skill-tag" style="background:var(--fire)">Sword</span></div>
            <p>${escapeHtml(s.desc)}</p>
            <p class="mini-note" style="margin-top:8px;">${escapeHtml(s.origin)}</p>
          </div>`).join("")}
        <p class="mini-note">Mastery ladder: ${GameData.swordMasteryLevels.join(" → ")}</p>
      </div>
      <div class="dm-section">
        <h3>Room's custom skills / thresholds</h3>
        ${custom.length ? custom.map((s) => `
          <div class="skill-card">
            <div class="skill-head"><strong>${escapeHtml(s.name)}</strong><span class="skill-tag" style="background:var(--mana)">${s.thresholdAttribute} ${s.thresholdValue}+</span></div>
            <p>${escapeHtml(s.description)}</p>
          </div>`).join("") : `<p class="empty-state">None defined yet — add some on the Skills tab.</p>`}
      </div>
    `;
  }

  async function onCharacterUpdate(character) {
    // Refresh every target-picker's option list so a newly-built character
    // (or a name change) shows up immediately, without losing whatever the
    // DM currently has selected.
    const optionsHtml = (await characters())
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}${c.isDM ? " (you)" : ""}</option>`)
      .join("");

    ["eventsTarget", "statsTarget", "invTarget", "diceTarget", "overviewTarget", "classesTarget"].forEach((id) => {
      const select = document.getElementById(id);
      if (!select) return;
      const previousValue = select.value;
      select.innerHTML = optionsHtml || `<option disabled>No characters yet</option>`;
      if ([...select.options].some((o) => o.value === previousValue)) {
        select.value = previousValue;
      }
      // If this select was (or now is) showing the character that just
      // changed, refresh the panel body underneath it too.
      if (select.value === character.id) {
        if (id === "eventsTarget") renderEventCurrentStatuses();
        if (id === "statsTarget") renderStatsEditorBody();
        if (id === "invTarget") renderInvList();
        if (id === "overviewTarget") renderOverviewBody();
        if (id === "classesTarget") renderClassesBody();
      }
    });
  }

  return { render, onCharacterUpdate, refreshSkillLib: renderSkillLibTab };
})();

// wireTabBar() is defined once in room.js and reused here.
