import sharp from "sharp";
import { renderBadgeIcon } from "./badgeIcons.js";

const GAP = 4;
const PADDING_X = 6;
const PADDING_Y = 6;
const ICON_SIZE = 25;
const MAX_PER_ROW = 8;
const LABEL_HEIGHT = 18;
const LABEL_GAP = 4;
const LABEL_COLOR = "#ffffff";
const LABEL_SCALE = 0.82;
const BADGES_WORDMARK_WIDTH = 72;
const BADGES_WORDMARK = `
  <g fill="${LABEL_COLOR}">
    <path d="M1 1h7.6c3.2 0 5.3 1.7 5.3 4.3 0 1.8-.9 3.1-2.5 3.7 2 .5 3.2 2 3.2 4.2 0 3.1-2.3 5-6.1 5H1V1zm4 3.1v3.6h3.2c1.2 0 1.9-.7 1.9-1.8s-.7-1.8-1.9-1.8H5zm0 6.6v4h3.9c1.4 0 2.2-.8 2.2-2s-.8-2-2.2-2H5z"/>
    <path d="M23.7 18.6c-3.2 0-5.3-2.1-5.3-5.3s2.2-5.4 5.2-5.4c2.8 0 4.8 1.9 4.8 4.7 0 .5 0 .9-.1 1.2h-6c.2 1.3 1.1 2 2.4 2 1 0 1.8-.4 2.7-1.2l2 2c-1.2 1.3-3 2-5.7 2zm-1.3-6.8h2.4c-.1-1-.7-1.7-1.6-1.7-.8 0-1.5.6-1.7 1.7z"/>
    <path d="M38.2 18.2v-1.1c-.7.9-1.7 1.4-3.1 1.4-2.8 0-4.8-2.2-4.8-5.3 0-3 1.9-5.2 4.8-5.2 1.3 0 2.4.5 3.1 1.4V1h3.8v17.2h-3.8zm-2.1-3c1.2 0 2.1-.9 2.1-2.1s-.9-2.1-2.1-2.1-2.1.9-2.1 2.1.9 2.1 2.1 2.1z"/>
    <path d="M49.6 22.4c-2.7 0-4.7-.8-6.1-2.2l2.1-2.4c1 1 2.2 1.5 3.7 1.5 1.8 0 2.8-.9 2.8-2.5v-.7c-.8.9-1.8 1.4-3.2 1.4-2.8 0-4.9-2-4.9-4.9S46.1 7.8 49 7.8c1.5 0 2.5.5 3.2 1.4V8h3.8v8.5c0 3.8-2.4 5.9-6.4 5.9zm.5-8.2c1.2 0 2.1-.7 2.1-1.8s-.9-1.8-2.1-1.8-2.1.7-2.1 1.8.9 1.8 2.1 1.8z"/>
    <path d="M63.5 18.6c-3.2 0-5.3-2.1-5.3-5.3s2.2-5.4 5.2-5.4c2.8 0 4.8 1.9 4.8 4.7 0 .5 0 .9-.1 1.2h-6c.2 1.3 1.1 2 2.4 2 1 0 1.8-.4 2.7-1.2l2 2c-1.2 1.3-3 2-5.7 2zm-1.3-6.8h2.4c-.1-1-.7-1.7-1.6-1.7-.8 0-1.5.6-1.7 1.7z"/>
    <path d="M73.9 18.5c-1.8 0-3.8-.5-5.4-1.7l1.5-2.4c1.3.9 2.8 1.4 4 1.4.7 0 1-.2 1-.5 0-.4-.5-.5-1.9-.8-2.5-.5-4.1-1.2-4.1-3.3 0-2.2 1.8-3.4 4.3-3.4 1.8 0 3.4.5 4.8 1.4l-1.4 2.5c-1.2-.7-2.5-1.1-3.5-1.1-.6 0-.9.2-.9.5 0 .4.5.5 1.8.8 2.7.5 4.2 1.4 4.2 3.4 0 2.3-1.8 3.3-4.4 3.3z"/>
  </g>
`;

function buildLabelSvg(width) {
  return Buffer.from(`
    <svg width="${width}" height="${LABEL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${PADDING_X} 1) scale(${LABEL_SCALE})">
        ${BADGES_WORDMARK}
      </g>
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
