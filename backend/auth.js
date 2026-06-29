import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// Ensure directories and data files exist
async function ensureDirs() {
  try {
    if (!existsSync(DATA_DIR)) {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }
    if (!existsSync(USERS_FILE)) {
      await fs.writeFile(USERS_FILE, JSON.stringify({}));
    }
  } catch (err) {
    console.error("Error creating backend auth directories:", err);
  }
}

// Securely hash password using built-in PBKDF2 algorithm
function hashPassword(password, salt) {
  const finalSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, finalSalt, 1000, 64, "sha512").toString("hex");
  return { salt: finalSalt, hash };
}

/**
 * Register a new user with a hashed password and empty state.
 */
export async function registerUser(username, password) {
  await ensureDirs();
  const cleanUser = username.trim().toLowerCase();
  
  if (!cleanUser || cleanUser.length < 3) {
    throw new Error("Username must be at least 3 characters long.");
  }
  if (!password || password.length < 4) {
    throw new Error("Password must be at least 4 characters long.");
  }

  const data = await fs.readFile(USERS_FILE, "utf-8").catch(() => "{}");
  const users = JSON.parse(data || "{}");

  if (users[cleanUser]) {
    throw new Error("Username is already taken.");
  }

  const { salt, hash } = hashPassword(password);
  users[cleanUser] = { salt, hash };

  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));

  // Initialize a blank study state for the user
  const stateFile = path.join(DATA_DIR, `state-${cleanUser}.json`);
  await fs.writeFile(stateFile, JSON.stringify({}));

  return { success: true, username: cleanUser };
}

/**
 * Validate credentials and load user state from server.
 */
export async function loginUser(username, password) {
  await ensureDirs();
  const cleanUser = username.trim().toLowerCase();

  if (!cleanUser || !password) {
    throw new Error("Please enter both a username and password.");
  }

  const data = await fs.readFile(USERS_FILE, "utf-8").catch(() => "{}");
  const users = JSON.parse(data || "{}");

  const record = users[cleanUser];
  if (!record) {
    throw new Error("Invalid username or password.");
  }

  const { hash } = hashPassword(password, record.salt);
  if (hash !== record.hash) {
    throw new Error("Invalid username or password.");
  }

  // Load state
  const stateFile = path.join(DATA_DIR, `state-${cleanUser}.json`);
  let userState = {};
  if (existsSync(stateFile)) {
    const stateData = await fs.readFile(stateFile, "utf-8");
    try {
      userState = JSON.parse(stateData || "{}");
    } catch {
      userState = {};
    }
  }

  return { success: true, username: cleanUser, state: userState };
}

/**
 * Persist user-specific study state on the server.
 */
export async function saveUserState(username, state) {
  await ensureDirs();
  const cleanUser = username.trim().toLowerCase();
  
  if (!cleanUser) {
    throw new Error("Invalid username.");
  }

  const stateFile = path.join(DATA_DIR, `state-${cleanUser}.json`);
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
  
  return { success: true };
}
