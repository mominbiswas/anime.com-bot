import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const LINKS_FILE = path.join(DATA_DIR, "profile-links.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(LINKS_FILE);
  } catch {
    await fs.writeFile(LINKS_FILE, "{}\n", "utf8");
  }
}

async function readLinks() {
  await ensureStore();
  const raw = await fs.readFile(LINKS_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

async function writeLinks(links) {
  await ensureStore();
  await fs.writeFile(LINKS_FILE, `${JSON.stringify(links, null, 2)}\n`, "utf8");
}

export async function getLinkedUsername(discordUserId) {
  const links = await readLinks();
  return links[discordUserId] ?? null;
}

export async function getAllLinkedProfiles() {
  const links = await readLinks();

  return Object.entries(links)
    .filter(([key, value]) => !key.startsWith("pending:") && typeof value === "string" && value)
    .map(([discordUserId, username]) => ({
      discordUserId,
      username
    }));
}

export async function setLinkedUsername(discordUserId, username) {
  const links = await readLinks();
  links[discordUserId] = username;
  await writeLinks(links);
}

export async function removeLinkedUsername(discordUserId) {
  const links = await readLinks();
  const hadValue = Object.prototype.hasOwnProperty.call(links, discordUserId);
  delete links[discordUserId];
  await writeLinks(links);
  return hadValue;
}

export async function getPendingLink(discordUserId) {
  const links = await readLinks();
  return links[`pending:${discordUserId}`] ?? null;
}

export async function setPendingLink(discordUserId, pendingLink) {
  const links = await readLinks();
  links[`pending:${discordUserId}`] = pendingLink;
  await writeLinks(links);
}

export async function removePendingLink(discordUserId) {
  const links = await readLinks();
  const key = `pending:${discordUserId}`;
  const hadValue = Object.prototype.hasOwnProperty.call(links, key);
  delete links[key];
  await writeLinks(links);
  return hadValue;
}
