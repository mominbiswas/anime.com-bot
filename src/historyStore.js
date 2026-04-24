import fs from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "./dataDir.js";

const DATA_DIR = getDataDir();
const HISTORY_FILE = path.join(DATA_DIR, "profile-history.json");
const MAX_SNAPSHOTS_PER_USER = 120;

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(HISTORY_FILE);
  } catch {
    await fs.writeFile(HISTORY_FILE, "{}\n", "utf8");
  }
}

async function readHistory() {
  await ensureStore();
  const raw = await fs.readFile(HISTORY_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

async function writeHistory(history) {
  await ensureStore();
  await fs.writeFile(HISTORY_FILE, `${JSON.stringify(history, null, 2)}\n`, "utf8");
}

function normalizeUsername(username) {
  return username.trim().replace(/^@/, "").toLowerCase();
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildSnapshot(profile) {
  const now = new Date();
  return {
    date: now.toISOString().slice(0, 10),
    capturedAt: now.toISOString(),
    aura: normalizeNumber(profile.aura),
    followers: normalizeNumber(profile.followers)
  };
}

export async function recordHistorySnapshot(profile) {
  if (!profile?.username) {
    return;
  }

  const history = await readHistory();
  const key = normalizeUsername(profile.username);
  const snapshots = Array.isArray(history[key]) ? history[key] : [];
  const nextSnapshot = buildSnapshot(profile);
  const existingIndex = snapshots.findIndex((entry) => entry?.date === nextSnapshot.date);

  if (existingIndex >= 0) {
    snapshots[existingIndex] = nextSnapshot;
  } else {
    snapshots.push(nextSnapshot);
  }

  snapshots.sort((left, right) => String(left.date).localeCompare(String(right.date)));
  history[key] = snapshots.slice(-MAX_SNAPSHOTS_PER_USER);
  await writeHistory(history);
}

export async function getHistorySnapshots(username) {
  const history = await readHistory();
  const key = normalizeUsername(username);
  const snapshots = Array.isArray(history[key]) ? history[key] : [];
  return snapshots
    .filter((entry) => entry && typeof entry === "object")
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));
}
