import fs from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "./dataDir.js";

const DATA_DIR = getDataDir();
const STORE_FILE = path.join(DATA_DIR, "activity-feeds.json");
const MAX_SEEN_ITEMS = 200;
export const ACTIVITY_FEED_TYPE_KEYS = [
  "reviews",
  "discussions",
  "episodeDiscussions",
  "memes",
  "polls",
  "news"
];

const DEFAULT_TYPE_SETTING = Object.freeze({
  maxAgeDays: 2,
  minReactions: 0,
  maxPostsPerRun: 1
});

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(STORE_FILE, "{\n  \"guilds\": {}\n}\n", "utf8");
  }
}

function normalizeSeenItems(values) {
  const items = Array.isArray(values) ? values : [];
  const seen = new Set();
  const normalized = [];

  for (const value of items) {
    if (typeof value !== "string" || !value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    normalized.push(value);
  }

  return normalized.slice(-MAX_SEEN_ITEMS);
}

function normalizeTypeSetting(value) {
  return {
    maxAgeDays: Number.isInteger(value?.maxAgeDays) && value.maxAgeDays > 0 ? value.maxAgeDays : DEFAULT_TYPE_SETTING.maxAgeDays,
    minReactions: Number.isInteger(value?.minReactions) && value.minReactions >= 0 ? value.minReactions : DEFAULT_TYPE_SETTING.minReactions,
    maxPostsPerRun: Number.isInteger(value?.maxPostsPerRun) && value.maxPostsPerRun > 0 ? value.maxPostsPerRun : DEFAULT_TYPE_SETTING.maxPostsPerRun
  };
}

function normalizeTypeSettings(values) {
  return Object.fromEntries(
    ACTIVITY_FEED_TYPE_KEYS.map((key) => [key, normalizeTypeSetting(values?.[key])])
  );
}

function normalizeGuildConfig(config) {
  if (!config || typeof config !== "object") {
    return null;
  }

  if (typeof config.channelId !== "string" || !config.channelId) {
    return null;
  }

  return {
    channelId: config.channelId,
    reviews: config.reviews !== false,
    discussions: config.discussions !== false,
    episodeDiscussions: config.episodeDiscussions === true,
    memes: config.memes === true,
    polls: config.polls === true,
    news: config.news === true,
    linkedUsers: config.linkedUsers !== false,
    typeSettings: normalizeTypeSettings(config.typeSettings),
    seenItems: normalizeSeenItems(config.seenItems)
  };
}

function normalizeStore(store) {
  const guildEntries = Object.entries(store?.guilds ?? {});
  const guilds = Object.fromEntries(
    guildEntries
      .map(([guildId, config]) => [guildId, normalizeGuildConfig(config)])
      .filter(([, config]) => config)
  );

  return { guilds };
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(STORE_FILE, "utf8");

  try {
    return normalizeStore(JSON.parse(raw));
  } catch {
    return { guilds: {} };
  }
}

async function writeStore(store) {
  await ensureStore();
  await fs.writeFile(STORE_FILE, `${JSON.stringify(normalizeStore(store), null, 2)}\n`, "utf8");
}

export async function getActivityFeedConfig(guildId) {
  const store = await readStore();
  return store.guilds[guildId] ?? null;
}

export async function getAllActivityFeedConfigs() {
  const store = await readStore();
  return Object.entries(store.guilds).map(([guildId, config]) => ({
    guildId,
    ...config
  }));
}

export async function setActivityFeedConfig(guildId, config) {
  const store = await readStore();
  const existing = store.guilds[guildId] ?? {
    seenItems: [],
    typeSettings: normalizeTypeSettings()
  };

  store.guilds[guildId] = normalizeGuildConfig({
    ...existing,
    ...config,
    typeSettings: config.typeSettings
      ? {
          ...existing.typeSettings,
          ...config.typeSettings
        }
      : existing.typeSettings,
    seenItems: config.seenItems ?? existing.seenItems
  });

  await writeStore(store);
  return store.guilds[guildId];
}

export async function disableActivityFeed(guildId) {
  const store = await readStore();
  const hadValue = Boolean(store.guilds[guildId]);
  delete store.guilds[guildId];
  await writeStore(store);
  return hadValue;
}

export async function markActivityFeedItemsSeen(guildId, itemKeys) {
  const store = await readStore();
  const existing = store.guilds[guildId];

  if (!existing) {
    return null;
  }

  store.guilds[guildId] = normalizeGuildConfig({
    ...existing,
    seenItems: [...existing.seenItems, ...itemKeys]
  });

  await writeStore(store);
  return store.guilds[guildId];
}

export function buildDefaultActivityTypeSettings() {
  return normalizeTypeSettings();
}
