/**
 * sync.js
 * -----------------------------------------------------------------------
 * Real-time layer. Events are written to the `rooms/{roomId}/events`
 * subcollection in Firestore and every connected client listens with
 * `onSnapshot`, so a DM action shows up live on every player's screen —
 * across tabs, browsers, and devices — not just other tabs of the same
 * browser. Swap Sync.emit/Sync.on for socket.emit/socket.on if you'd
 * rather run a dedicated WebSocket layer instead; the event catalogue
 * below is the contract either way.
 *
 * Every emitted event is tagged with this tab's clientId. emit() fires
 * listeners locally right away *and* writes the event to Firestore so
 * other tabs hear it — but this tab is also subscribed to that same
 * Firestore stream, so without the clientId check below it would hear
 * its own write come back and fire the listener a second time (visible
 * as duplicated chat lines, etc). The onSnapshot handler skips any
 * event whose clientId matches our own for exactly that reason.
 * -----------------------------------------------------------------------
 */

const Sync = (() => {
  const clientId = `client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  let unsubscribe = null;
  let connectedAt = 0;
  const listeners = {};

  function connect(roomId) {
    if (unsubscribe) unsubscribe();
    connectedAt = Date.now();

    unsubscribe = firestoreDB
      .collection("rooms")
      .doc(roomId)
      .collection("events")
      .where("createdAt", ">", connectedAt)
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          const { type, payload, clientId: senderId } = change.doc.data();
          if (senderId === clientId) return; // already handled locally in emit()
          (listeners[type] || []).forEach((fn) => fn(payload));
        });
      });
  }

  function emit(type, payload) {
    // Fire locally first so the sender's own UI updates immediately —
    // no need to round-trip through Firestore for your own action.
    (listeners[type] || []).forEach((fn) => fn(payload));

    const session = DB.getSession();
    if (!session || !session.roomId) return;
    firestoreDB
      .collection("rooms")
      .doc(session.roomId)
      .collection("events")
      .add({ type, payload, clientId, createdAt: Date.now() });
  }

  function on(type, fn) {
    listeners[type] = listeners[type] || [];
    listeners[type].push(fn);
  }

  return { connect, emit, on };
})();

/*
 * Event catalogue (payload shapes) — the contract between DM Tools and
 * every connected player's UI:
 *
 *   "chat:new"          { message }                       new chat/system/roll line
 *   "character:update"  { character }                     stats/HP/inventory/status changed, or a character newly built
 *   "dice:request"      { request, characterId }           DM asked one player to roll
 *   "dice:result"       { request }                        a roll was completed
 *   "note:public"       { note }                           DM pushed a visible note/whisper
 *   "skill:new"         { skill }                          DM added a custom skill/threshold
 *   "turn:update"       { activeCharacterId }               DM changed whose turn it is (or cleared it)
 *   "chat:lock"         { chatUnlocked }                     DM opened/closed chat for everyone
 *   "roll:lock"         { rollUnlocked }                     DM opened/closed free rolling for everyone
 */
