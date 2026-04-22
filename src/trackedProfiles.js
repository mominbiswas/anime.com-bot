import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const TRACKED_FILE = path.join(DATA_DIR, "tracked-profiles.json");
const GLOBAL_KEY = "global";

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
  const globalUsernames = trackedProfiles[GLOBAL_KEY];

  if (Array.isArray(globalUsernames)) {
    return globalUsernames;
  }

  const flattened = Object.values(trackedProfiles)
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .filter((value, index, array) =>
      typeof value === "string" && array.findIndex((entry) => entry.toLowerCase() === value.toLowerCase()) === index
    );

  if (flattened.length) {
    trackedProfiles[GLOBAL_KEY] = flattened;
    await writeTrackedProfiles(trackedProfiles);
  }

  return flattened;
}

export async function addTrackedUsername(guildId, username) {
  const trackedProfiles = await readTrackedProfiles();
  const existing = await getTrackedUsernames(guildId);
  const alreadyTracked = existing.some((entry) => entry.toLowerCase() === username.toLowerCase());

  if (alreadyTracked) {
    return false;
  }

  trackedProfiles[GLOBAL_KEY] = [...existing, username];
  await writeTrackedProfiles(trackedProfiles);
  return true;
}

export async function removeTrackedUsername(guildId, username) {
  const trackedProfiles = await readTrackedProfiles();
  const existing = await getTrackedUsernames(guildId);
  const filtered = existing.filter((entry) => entry.toLowerCase() !== username.toLowerCase());

  if (filtered.length === existing.length) {
    return false;
  }

  trackedProfiles[GLOBAL_KEY] = filtered;
  await writeTrackedProfiles(trackedProfiles);
  return true;
}
