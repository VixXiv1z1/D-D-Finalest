/**
 * auth.js
 * -----------------------------------------------------------------------
 * Minimal client-side auth for the prototype. Passwords are stored in
 * plaintext in Firestore — that is only acceptable for a local prototype.
 * A production build must hash passwords server-side (bcrypt/argon2, or
 * better, use Firebase Authentication instead of hand-rolled accounts)
 * and never keep credentials readable from the client; see SCHEMA.md's
 * `users` table for the intended real shape (password_hash, not password).
 *
 * The "who's currently signed in on this browser" pointer is kept in
 * localStorage, same as before — it's a local convenience (so you don't
 * have to log in again on refresh), not shared game data, so it doesn't
 * need to live in Firestore.
 * -----------------------------------------------------------------------
 */

const CURRENT_USER_KEY = "vtt:currentUserId";

async function getCurrentUser() {
  const id = localStorage.getItem(CURRENT_USER_KEY);
  return id ? await DB.getUser(id) : null;
}

function signIn(user) {
  localStorage.setItem(CURRENT_USER_KEY, user.id);
}

function signOut() {
  localStorage.removeItem(CURRENT_USER_KEY);
  DB.clearSession();
}
