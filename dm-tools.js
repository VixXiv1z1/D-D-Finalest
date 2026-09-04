/**
 * dm-tools.js — the Dice Master's right-side control panel: private
 * notes, event triggers (status effects), live stat/HP edits, inventory
 * management, forcing rolls, and defining custom skills with attribute
 * thresholds. Every write here goes through DB then Sync.emit(...) so
 * the affected player's screen updates immediately (see sync.js).
 */

const DMTools = (() => {
  let roomRef;

  async function render(tabBar, panels, room) {
    roomRef = room;
    tabBar.innerHTML = `
      <button data-tab="notes" class="active">Notes</button>
      <button data-tab="events">Events</button>
      <button data-tab="stats">Stats & HP</button>
      <button data-tab="inventory">Inventory</button>
      <button data-tab="dice">Dice</button>
      <button data-tab="skills">Skills</button>
      <button data-tab="spellbook">Spells</button>
      <button data-tab="skilllib">Skill Lib</button>
    `;
    panels.innerHTML = `
      <div class="tab-panel active" data-panel="notes" id="dmNotesTab"></div>
      <div class="tab-panel" data-panel="events" id="dmEventsTab"></div>
      <div class="tab-panel" data-panel="stats" id="dmStatsTab"></div>
      <div class="tab-panel" data-panel="inventory" id="dmInventoryTab"></div>
      <div class="tab-panel" data-panel="dice" id="dmDiceTab"></div>
      <div class="tab-panel" data-panel="skills" id="dmSkillsTab"></div>
      <div class="tab-panel" data-panel="spellbook" id="dmSpellbookTab"></div>
      <div class="tab-panel" data-panel="skilllib" id="dmSkillLibTab"></div>
    `;
    wireTabBar(tabBar, document.getElementById("rightSidebar"));

    await Promise.all([
      renderNotesTab(),
      renderEventsTab(),
      renderStatsTab(),
      renderInventoryTab(),
      renderDiceTab(),
      renderSkillsTab(),
      renderSpellbookTab(),
      renderSkillLibTab(),
    ]);
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

    ["eventsTarget", "statsTarget", "invTarget", "diceTarget"].forEach((id) => {
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
      }
    });
  }

  return { render, onCharacterUpdate, refreshSkillLib: renderSkillLibTab };
})();

// wireTabBar() is defined once in room.js and reused here.
