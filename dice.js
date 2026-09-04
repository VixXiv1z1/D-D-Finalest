/**
 * dice.js — shared dice-rolling logic used by both the player Dice tab
 * and the DM's "force a roll" tool.
 */

const Dice = {
  roll(sides) {
    return 1 + Math.floor(Math.random() * sides);
  },

  /**
   * Renders a pending dice-request card into `container` for the player
   * who owns it, animates a short "rolling" beat, then resolves the
   * request in the DB, tells every tab about it via Sync, and posts the
   * result into the shared story feed.
   */
  renderRequestCard(container, request, character) {
    const card = document.createElement("div");
    card.className = "dice-request-card";
    card.innerHTML = `
      <p><strong>${escapeHtml(request.label || "The Dice Master")}</strong> asks you to roll a d${request.sides}.</p>
      <div class="die-face" id="face-${request.id}">?</div>
      <button class="btn btn-primary btn-block" id="rollBtn-${request.id}">Roll d${request.sides}</button>
    `;
    container.appendChild(card);

    document.getElementById(`rollBtn-${request.id}`).addEventListener("click", () => {
      const face = document.getElementById(`face-${request.id}`);
      face.classList.add("rolling");
      let ticks = 0;
      const spin = setInterval(async () => {
        face.textContent = Dice.roll(request.sides);
        ticks++;
        if (ticks > 8) {
          clearInterval(spin);
          face.classList.remove("rolling");
          const result = Dice.roll(request.sides);
          face.textContent = result;
          await DB.completeDiceRequest(request.id, result);
          const msg = await DB.addMessage({
            roomId: request.roomId,
            authorId: character.id,
            authorName: character.name,
            type: "roll",
            text: `rolled a ${result} on d${request.sides}${request.label ? ` — ${request.label}` : ""}`,
          });
          Sync.emit("chat:new", { message: msg });
          Sync.emit("dice:result", { request: { ...request, status: "completed", result } });
          card.remove();
        }
      }, 90);
    });
  },

  /** Free roll (no DM request) triggered by the player themselves. */
  async freeRoll(sides, roomId, character) {
    const result = Dice.roll(sides);
    const msg = await DB.addMessage({
      roomId,
      authorId: character.id,
      authorName: character.name,
      type: "roll",
      text: `rolled a ${result} on d${sides}`,
    });
    Sync.emit("chat:new", { message: msg });
    return result;
  },
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
