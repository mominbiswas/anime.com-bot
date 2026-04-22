import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const TRACKED_FILE = path.join(DATA_DIR, "tracked-profiles.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(TRACKED_FILE);
  } catch {
    await fs.writeFile(TRACKED_FILE, "{}\n", "utf8");
  }
}

async function readTrackedProfiles() {
  await ensureStore();
  const raw = await fs.readFile(TRACKED_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

async function writeTrackedProfiles(trackedProfiles) {
  await ensureStore();
  await fs.writeFile(TRACKED_FILE, `${JSON.stringify(trackedProfiles, null, 2)}\n`, "utf8");
}

export async function getTrackedUsernames(guildId) {
  const trackedProfiles = await readTrackedProfiles();
  const usernames = trackedProfiles[guildId];
  return Array.isArray(usernames) ? usernames : [];
}

export async function addTrackedUsername(guildId, username) {
  const trackedProfiles = await readTrackedProfiles();
  const existing = Array.isArray(trackedProfiles[guildId]) ? trackedProfiles[guildId] : [];
  const alreadyTracked = existing.some((entry) => entry.toLowerCase() === username.toLowerCase());

  if (alreadyTracked) {
    return false;
  }

  trackedProfiles[guildId] = [...existing, username];
  await writeTrackedProfiles(trackedProfiles);
  return true;
}

export async function removeTrackedUsername(guildId, username) {
  const trackedProfiles = await readTrackedProfiles();
  const existing = Array.isArray(trackedProfiles[guildId]) ? trackedProfiles[guildId] : [];
  const filtered = existing.filter((entry) => entry.toLowerCase() !== username.toLowerCase());

  if (filtered.length === existing.length) {
    return false;
  }

  trackedProfiles[guildId] = filtered;
  await writeTrackedProfiles(trackedProfiles);
  return true;
}
