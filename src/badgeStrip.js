import sharp from "sharp";
import { renderBadgeIcon } from "./badgeIcons.js";

const GAP = 4;
const PADDING_X = 6;
const PADDING_Y = 6;
const ICON_SIZE = 25;
const MAX_PER_ROW = 8;
const LABEL_HEIGHT = 16;
const LABEL_GAP = 4;
const LABEL_COLOR = "#ffffff";
const LETTER_SCALE = 0.9;
const LETTER_SPACING = 3;
const BADGES_PATHS = [
  { width: 12, d: "M1 1 L1 15 M1 1 L7 1 Q11 1 11 4 Q11 7 7 7 L1 7 M1 7 L7 7 Q11 7 11 11 Q11 15 7 15 L1 15" },
  { width: 12, d: "M1 15 L5 1 L9 15 M2.5 10 L7.5 10" },
  { width: 12, d: "M1 1 L1 15 M1 1 L6 1 Q11 1 11 8 Q11 15 6 15 L1 15" },
  { width: 12, d: "M11 4 Q10 1 6 1 Q1 1 1 8 Q1 15 6 15 Q10 15 11 11 M11 11 L7 11" },
  { width: 11, d: "M10 1 L1 1 L1 15 L10 15 M1 8 L8 8" },
  { width: 11, d: "M10 3 Q9 1 5 1 Q1 1 1 5 Q1 8 5 8 Q10 8 10 11 Q10 15 5 15 Q1 15 1 13" }
];

function buildLabelSvg(width) {
  let x = PADDING_X;
  const paths = [];

  for (const letter of BADGES_PATHS) {
    paths.push(
      `<path d="${letter.d}" transform="translate(${x} 1) scale(${LETTER_SCALE})" fill="none" stroke="${LABEL_COLOR}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />`
    );
    x += letter.width * LETTER_SCALE + LETTER_SPACING;
  }

  return Buffer.from(`
    <svg width="${width}" height="${LABEL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${paths.join("")}
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
