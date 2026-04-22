import fs from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "./dataDir.js";

const DATA_DIR = getDataDir();
const SHARED_TRACKED_FILE = path.join(DATA_DIR, "shared-tracked-profiles.json");
const LEGACY_TRACKED_FILE = path.join(DATA_DIR, "tracked-profiles.json");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeTrackedPayload(payload) {
  const usernames = Array.isArray(payload?.usernames) ? payload.usernames : [];

  return {
    usernames: usernames.filter((value, index, array) =>
      typeof value === "string" &&
      value.trim() &&
      array.findIndex((entry) => typeof entry === "string" && entry.toLowerCase() === value.toLowerCase()) === index
    )
  };
}

function collectLegacyUsernames(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  return Object.values(payload)
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .filter((value, index, array) =>
      typeof value === "string" &&
      value.trim() &&
      array.findIndex((entry) => typeof entry === "string" && entry.toLowerCase() === value.toLowerCase()) === index
    );
}

async function writeSharedTrackedProfiles(payload) {
  await ensureDataDir();
  await fs.writeFile(
    SHARED_TRACKED_FILE,
    `${JSON.stringify(normalizeTrackedPayload(payload), null, 2)}\n`,
    "utf8"
  );
}

async function migrateLegacyTrackedProfilesIfNeeded() {
  const hasSharedFile = await fileExists(SHARED_TRACKED_FILE);

  if (hasSharedFile) {
    return;
  }

  const hasLegacyFile = await fileExists(LEGACY_TRACKED_FILE);

  if (!hasLegacyFile) {
    await writeSharedTrackedProfiles({ usernames: [] });
    return;
  }

  const rawLegacy = await fs.readFile(LEGACY_TRACKED_FILE, "utf8");
  let parsedLegacy;

  try {
    parsedLegacy = JSON.parse(rawLegacy);
  } catch {
    parsedLegacy = {};
  }

  await writeSharedTrackedProfiles({
    usernames: collectLegacyUsernames(parsedLegacy)
  });
}

async function readSharedTrackedProfiles() {
  await ensureDataDir();
  await migrateLegacyTrackedProfilesIfNeeded();
  const raw = await fs.readFile(SHARED_TRACKED_FILE, "utf8");

  try {
    return normalizeTrackedPayload(JSON.parse(raw));
  } catch {
    return { usernames: [] };
  }
}

export async function getTrackedUsernames() {
  const trackedProfiles = await readSharedTrackedProfiles();
  return trackedProfiles.usernames;
}

export async function addTrackedUsername(_scope, username) {
  const trackedProfiles = await readSharedTrackedProfiles();
  const alreadyTracked = trackedProfiles.usernames.some(
    (entry) => entry.toLowerCase() === username.toLowerCase()
  );

  if (alreadyTracked) {
    return false;
  }

  trackedProfiles.usernames.push(username);
  await writeSharedTrackedProfiles(trackedProfiles);
  return true;
}

export async function removeTrackedUsername(_scope, username) {
  const trackedProfiles = await readSharedTrackedProfiles();
  const filtered = trackedProfiles.usernames.filter(
    (entry) => entry.toLowerCase() !== username.toLowerCase()
  );

  if (filtered.length === trackedProfiles.usernames.length) {
    return false;
  }

  await writeSharedTrackedProfiles({ usernames: filtered });
  return true;
}
