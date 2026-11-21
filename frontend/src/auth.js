// Local demo auth: accounts live in this browser's localStorage.
// Passwords are NEVER stored in plain text: PBKDF2 hash + random salt.
// For real users, move this to a backend (hashed in DB, httpOnly cookie session).
const USERS = "costpilot.users";
const REMEMBER = "costpilot.rememberedId";
const SESSION = "costpilot.session";

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

async function hash(password, saltB64) {
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return b64(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, key, 256));
}

export const rememberedId = () => localStorage.getItem(REMEMBER) || "";
export const currentUser = () => read(SESSION, null);
export const logout = () => localStorage.removeItem(SESSION);

export async function register(id, password) {
  id = id.trim();
  if (id.length < 3) throw new Error("Login ID needs at least 3 characters.");
  if (password.length < 6) throw new Error("Password needs at least 6 characters.");
  const users = read(USERS, {});
  if (users[id]) throw new Error("That login ID already exists. Sign in instead.");
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  users[id] = { salt, hash: await hash(password, salt), created: Date.now() };
  write(USERS, users);
  return signIn(id, true);
}

export async function login(id, password, remember) {
  id = id.trim();
  const u = read(USERS, {})[id];
  if (!u || (await hash(password, u.salt)) !== u.hash) throw new Error("Login ID or password is wrong.");
  return signIn(id, remember);
}

function signIn(id, remember) {
  if (remember) localStorage.setItem(REMEMBER, id); else localStorage.removeItem(REMEMBER);
  const session = { id, at: Date.now() };
  write(SESSION, session);
  return session;
}