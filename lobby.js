/**
 * lobby.js — index.html controller: auth tabs + join/create room.
 */

const els = {
  tabLogin: document.getElementById("tabLogin"),
  tabRegister: document.getElementById("tabRegister"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  authArea: document.getElementById("authArea"),
  lobbyArea: document.getElementById("lobbyArea"),
  whoAmI: document.getElementById("whoAmI"),
};

function showAuthTab(which) {
  const isLogin = which === "login";
  els.tabLogin.classList.toggle("active", isLogin);
  els.tabRegister.classList.toggle("active", !isLogin);
  els.loginForm.classList.toggle("active", isLogin);
  els.registerForm.classList.toggle("active", !isLogin);
}
els.tabLogin.addEventListener("click", () => showAuthTab("login"));
els.tabRegister.addEventListener("click", () => showAuthTab("register"));

async function refreshLobbyView() {
  const user = await getCurrentUser();
  if (user) {
    els.authArea.classList.add("hidden");
    els.lobbyArea.classList.remove("hidden");
    els.whoAmI.textContent = user.username;
  } else {
    els.authArea.classList.remove("hidden");
    els.lobbyArea.classList.add("hidden");
  }
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const msg = document.getElementById("loginMsg");
  const user = await DB.findUser(username, password);
  if (!user) {
    msg.textContent = "No account matches that username and password.";
    msg.className = "form-msg error";
    return;
  }
  signIn(user);
  msg.textContent = "";
  refreshLobbyView();
});

document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const msg = document.getElementById("registerMsg");
  try {
    const user = await DB.createUser(username, password);
    signIn(user);
    msg.textContent = "";
    refreshLobbyView();
  } catch (err) {
    msg.textContent = err.message;
    msg.className = "form-msg error";
  }
});

document.getElementById("createForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = await getCurrentUser();
  const name = document.getElementById("createName").value.trim();
  const pointBudget = document.getElementById("createBudget").value;
  const room = await DB.createRoom({ name, dmUserId: user.id, pointBudget });
  // Room creator is permanently the DM for this room.
  const character = await DB.createCharacter({ roomId: room.id, userId: user.id, name: `${user.username} (DM)`, isDM: true });
  DB.setSession({ userId: user.id, roomId: room.id, characterId: character.id });
  window.location.href = `room.html?new=1`;
});

document.getElementById("joinForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = await getCurrentUser();
  const code = document.getElementById("joinCode").value.trim().toUpperCase();
  const charName = document.getElementById("joinCharName").value.trim();
  const msg = document.getElementById("joinMsg");

  const room = await DB.getRoomByCode(code);
  if (!room) {
    msg.textContent = "No room found with that code.";
    msg.className = "form-msg error";
    return;
  }

  let character = await DB.getCharacterByUserAndRoom(user.id, room.id);
  if (!character) {
    character = await DB.createCharacter({
      roomId: room.id,
      userId: user.id,
      name: charName || user.username,
      isDM: room.dmUserId === user.id,
    });
  }
  DB.setSession({ userId: user.id, roomId: room.id, characterId: character.id });
  window.location.href = `room.html`;
});

document.getElementById("signOutBtn").addEventListener("click", () => {
  signOut();
  refreshLobbyView();
});

refreshLobbyView();
