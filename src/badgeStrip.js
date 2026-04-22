import sharp from "sharp";
import { renderBadgeIcon } from "./badgeIcons.js";

const GAP = 4;
const PADDING_X = 6;
const PADDING_Y = 6;
const ICON_SIZE = 25;
const MAX_PER_ROW = 8;
const LABEL_HEIGHT = 20;
const LABEL_GAP = 4;
const LABEL_COLOR = "#ffffff";

function buildLabelSvg(width) {
  return Buffer.from(`
    <svg width="${width}" height="${LABEL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="${PADDING_X}"
        y="15"
        fill="${LABEL_COLOR}"
        font-size="15"
        font-weight="700"
        font-family="Arial, sans-serif"
      >Badges</text>
    </svg>
  `);
}

export async function renderBadgeStrip(badges) {
  const items = badges.filter((badge) => badge.localFilePath).slice(0, 32);

  if (!items.length) {
    return null;
  }

  const columns = Math.min(MAX_PER_ROW, items.length);
  const rows = Math.ceil(items.length / MAX_PER_ROW);
  const width = PADDING_X * 2 + columns * ICON_SIZE + (columns - 1) * GAP;
  const iconTop = PADDING_Y + LABEL_HEIGHT + LABEL_GAP;
  const height = iconTop + rows * ICON_SIZE + (rows - 1) * GAP + PADDING_Y;

  const composites = [{ input: buildLabelSvg(width), left: 0, top: PADDING_Y }];

  for (let index = 0; index < items.length; index += 1) {
    const badge = items[index];
    const row = Math.floor(index / MAX_PER_ROW);
    const column = index % MAX_PER_ROW;
    const left = PADDING_X + column * (ICON_SIZE + GAP);
    const top = iconTop + row * (ICON_SIZE + GAP);
    const icon = await renderBadgeIcon(badge.localFilePath);

    composites.push({ input: icon, left, top });
  }

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(composites)
    .png()
    .toBuffer();
}
