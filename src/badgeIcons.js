import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const BADGE_DIR = path.resolve(process.cwd(), "badge");
const ICON_SIZE = 25;

function badgeFilePath(key) {
  return path.join(BADGE_DIR, `${key}.png`);
}

export function resolveLocalBadgePath(key) {
  const filePath = badgeFilePath(key);
  return fs.existsSync(filePath) ? filePath : null;
}

export async function renderBadgeIcon(localFilePath) {
  return sharp(localFilePath)
    .resize(ICON_SIZE, ICON_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
}
