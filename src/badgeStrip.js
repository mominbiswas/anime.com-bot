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
const PIXEL_SIZE = 2;
const LETTER_SPACING = 2;
const BADGES_GLYPHS = {
  B: [
    "11110",
    "10001",
    "10001",
    "11110",
    "10001",
    "10001",
    "11110"
  ],
  A: [
    "01110",
    "10001",
    "10001",
    "11111",
    "10001",
    "10001",
    "10001"
  ],
  D: [
    "11110",
    "10001",
    "10001",
    "10001",
    "10001",
    "10001",
    "11110"
  ],
  G: [
    "01111",
    "10000",
    "10000",
    "10111",
    "10001",
    "10001",
    "01110"
  ],
  E: [
    "11111",
    "10000",
    "10000",
    "11110",
    "10000",
    "10000",
    "11111"
  ],
  S: [
    "01111",
    "10000",
    "10000",
    "01110",
    "00001",
    "00001",
    "11110"
  ]
};

function buildLabelSvg(width) {
  let x = PADDING_X;
  const rects = [];

  for (const character of "BADGES") {
    const glyph = BADGES_GLYPHS[character];

    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] !== "1") {
          continue;
        }

        rects.push(
          `<rect x="${x + column * PIXEL_SIZE}" y="${3 + row * PIXEL_SIZE}" width="${PIXEL_SIZE}" height="${PIXEL_SIZE}" fill="${LABEL_COLOR}" />`
        );
      }
    }

    x += glyph[0].length * PIXEL_SIZE + LETTER_SPACING;
  }

  return Buffer.from(`
    <svg width="${width}" height="${LABEL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${rects.join("")}
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
