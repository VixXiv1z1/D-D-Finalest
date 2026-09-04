/**
 * db.js
 * -----------------------------------------------------------------------
 * Data layer backed by Cloud Firestore (see firebase-config.js for setup).
 * Every collection below maps 1:1 to a table in SCHEMA.md. Nothing outside
 * this file talks to Firestore directly — callers just `await` these
 * methods, same shapes as before, just asynchronous now.
 * -----------------------------------------------------------------------
 */

function col(name) {
  return firestoreDB.collection(name);
}

function docToObj(doc) {
  return { id: doc.id, ...doc.data() };
}

function sortByCreatedAt(rows) {
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

const DB = {
  /* ---------------------------------------------------------- users */
  async createUser(username, password) {
    const clash = await col("users").where("usernameLower", "==", username.toLowerCase()).limit(1).get();
    if (!clash.empty) {
      throw new Error("That username is already taken.");
    }
    const data = { username, usernameLower: username.toLowerCase(), password, createdAt: Date.now() };
    const ref = await col("users").add(data);
    return { id: ref.id, ...data };
  },

  async findUser(username, password) {
    const snap = await col("users").where("usernameLower", "==", username.toLowerCase()).get();
    const match = snap.docs.find((d) => d.data().password === password);
    return match ? docToObj(match) : null;
  },

  async getUser(userId) {
    if (!userId) return null;
    const doc = await col("users").doc(userId).get();
    return doc.exists ? docToObj(doc) : null;
  },

  /* ---------------------------------------------------------- rooms */
  async createRoom({ name, dmUserId, pointBudget }) {
    const code = Math.random().toString(36).slice(2, 7).toUpperCase();
    const data = {
      code,
      name: name || `${code}'s Table`,
      dmUserId,
      pointBudget: Number(pointBudget) || 20,
      createdAt: Date.now(),
    };
    const ref = await col("rooms").add(data);
    return { id: ref.id, ...data };
  },

  async getRoomByCode(code) {
    const snap = await col("rooms").where("code", "==", code.toUpperCase()).limit(1).get();
    return snap.empty ? null : docToObj(snap.docs[0]);
  },

  async getRoom(roomId) {
    if (!roomId) return null;
    const doc = await col("rooms").doc(roomId).get();
    return doc.exists ? docToObj(doc) : null;
  },

  /**
   * Turn / chat-lock state lives directly on the room document:
   *   activeCharacterId  — id of the character whose turn it is, or null
   *   chatUnlocked       — true if the DM has opened chat to everyone
   *   rollUnlocked       — true if the DM has opened free rolling to everyone
   * All three default to "locked down" (null / false / false) so a fresh
   * room starts silent until the DM says otherwise.
   */
  async setRoomTurn(roomId, activeCharacterId) {
    await col("rooms").doc(roomId).update({ activeCharacterId: activeCharacterId || null });
    return DB.getRoom(roomId);
  },

  async setChatUnlocked(roomId, chatUnlocked) {
    await col("rooms").doc(roomId).update({ chatUnlocked: !!chatUnlocked });
    return DB.getRoom(roomId);
  },

  async setRollUnlocked(roomId, rollUnlocked) {
    await col("rooms").doc(roomId).update({ rollUnlocked: !!rollUnlocked });
    return DB.getRoom(roomId);
  },

  /* ----------------------------------------------------- characters */
  emptyStats() {
    const stats = {};
    GameData.attributes.forEach((a) => (stats[a] = 0));
    return stats;
  },

  async upsertCharacter(character) {
    const { id, ...data } = character;
    if (id) {
      await col("characters").doc(id).set(data, { merge: false });
      return { id, ...data };
    }
    const ref = await col("characters").add(data);
    return { id: ref.id, ...data };
  },

  async createCharacter({ roomId, userId, name, isDM }) {
    const data = {
      roomId,
      userId,
      name,
      isDM: !!isDM,
      stats: DB.emptyStats(),
      pointsSpent: 0,
      built: false,
      skipped: false,
      hp: { current: 20, max: 20 },
      statusEffects: [],
      inventory: [],
      unlockedSkills: [],
      createdAt: Date.now(),
    };
    const ref = await col("characters").add(data);
    return { id: ref.id, ...data };
  },

  async getCharactersByRoom(roomId) {
    const snap = await col("characters").where("roomId", "==", roomId).get();
    return sortByCreatedAt(snap.docs.map(docToObj));
  },

  async getCharacterByUserAndRoom(userId, roomId) {
    const snap = await col("characters")
      .where("roomId", "==", roomId)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    return snap.empty ? null : docToObj(snap.docs[0]);
  },

  async getCharacter(characterId) {
    if (!characterId) return null;
    const doc = await col("characters").doc(characterId).get();
    return doc.exists ? docToObj(doc) : null;
  },

  /* -------------------------------------------------------- messages */
  async addMessage({ roomId, authorId, authorName, type, text, meta }) {
    const data = {
      roomId,
      authorId,
      authorName,
      type: type || "chat", // 'chat' | 'system' | 'roll' | 'whisper'
      text,
      meta: meta || null,
      createdAt: Date.now(),
    };
    const ref = await col("messages").add(data);
    return { id: ref.id, ...data };
  },

  async getMessagesByRoom(roomId) {
    const snap = await col("messages").where("roomId", "==", roomId).get();
    return sortByCreatedAt(snap.docs.map(docToObj));
  },

  /* ---------------------------------------------------- dice requests */
  async createDiceRequest({ roomId, targetCharacterId, requestedBy, sides, label }) {
    const data = {
      roomId,
      targetCharacterId,
      requestedBy,
      sides: sides || 20,
      label: label || "",
      status: "pending", // 'pending' | 'completed'
      result: null,
      createdAt: Date.now(),
    };
    const ref = await col("diceRequests").add(data);
    return { id: ref.id, ...data };
  },

  async completeDiceRequest(requestId, result) {
    const ref = col("diceRequests").doc(requestId);
    const doc = await ref.get();
    if (!doc.exists) return null;
    await ref.update({ status: "completed", result });
    return { id: doc.id, ...doc.data(), status: "completed", result };
  },

  async getPendingDiceRequests(roomId, characterId) {
    const snap = await col("diceRequests")
      .where("roomId", "==", roomId)
      .where("targetCharacterId", "==", characterId)
      .where("status", "==", "pending")
      .get();
    return sortByCreatedAt(snap.docs.map(docToObj));
  },

  /* --------------------------------------------------------- dm notes */
  async addDMNote({ roomId, authorId, text, visibility }) {
    const data = {
      roomId,
      authorId,
      text,
      visibility: visibility || "private", // 'private' | 'public'
      createdAt: Date.now(),
    };
    const ref = await col("dmNotes").add(data);
    return { id: ref.id, ...data };
  },

  async getDMNotes(roomId) {
    const snap = await col("dmNotes").where("roomId", "==", roomId).get();
    return sortByCreatedAt(snap.docs.map(docToObj));
  },

  /* ------------------------------------------------------ custom skills */
  async addCustomSkill({ roomId, name, description, thresholdAttribute, thresholdValue }) {
    const data = {
      roomId,
      name,
      description,
      thresholdAttribute,
      thresholdValue: Number(thresholdValue) || 0,
      createdAt: Date.now(),
    };
    const ref = await col("customSkills").add(data);
    return { id: ref.id, ...data };
  },

  async getCustomSkills(roomId) {
    const snap = await col("customSkills").where("roomId", "==", roomId).get();
    return sortByCreatedAt(snap.docs.map(docToObj));
  },

  /* ------------------------------------------------------- current session
   * The session pointer (who am I / which room / which character, right
   * now, in this tab) is deliberately kept in sessionStorage rather than
   * Firestore — it's local UI state, not shared game data, and doesn't
   * need to sync across devices or survive the tab closing.
   */
  setSession({ userId, roomId, characterId }) {
    sessionStorage.setItem("vtt:session", JSON.stringify({ userId, roomId, characterId }));
  },

  getSession() {
    try {
      return JSON.parse(sessionStorage.getItem("vtt:session"));
    } catch {
      return null;
    }
  },

  clearSession() {
    sessionStorage.removeItem("vtt:session");
  },
};
