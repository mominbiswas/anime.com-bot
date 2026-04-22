import sharp from "sharp";
import { renderBadgeStrip } from "./badgeStrip.js";

const CARD_WIDTH = 760;
const CARD_PADDING_X = 24;
const CARD_PADDING_Y = 18;
const COLUMN_GAP = 18;
const ROW_GAP = 16;
const CELL_HEIGHT = 56;
const GRID_COLUMNS = 3;
const HEADER_HEIGHT = 26;
const HEADER_GAP = 12;
const BADGE_TOP_GAP = 22;
const FOOTER_TOP_GAP = 16;

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildTextSvg({ width, height, profile, ranks, stats }) {
  const columnWidth = Math.floor((width - CARD_PADDING_X * 2 - COLUMN_GAP * 2) / GRID_COLUMNS);
  const rankParts = [];

  if (ranks?.aura) {
    rankParts.push(`Aura Rank #${ranks.aura}`);
  }

  if (ranks?.followers) {
    rankParts.push(`Followers Rank #${ranks.followers}`);
  }

  const cells = stats
    .map((stat, index) => {
      const row = Math.floor(index / GRID_COLUMNS);
      const column = index % GRID_COLUMNS;
      const x = CARD_PADDING_X + column * (columnWidth + COLUMN_GAP);
      const y = CARD_PADDING_Y + HEADER_HEIGHT + HEADER_GAP + row * (CELL_HEIGHT + ROW_GAP);

      return `
        <rect x="${x}" y="${y}" width="${columnWidth}" height="${CELL_HEIGHT}" rx="16" fill="rgba(255,255,255,0.06)" />
        <text x="${x + 14}" y="${y + 21}" fill="#d7c8f4" font-size="13" font-weight="600" font-family="sans-serif">${escapeXml(stat.label)}</text>
        <text x="${x + 14}" y="${y + 43}" fill="#ffffff" font-size="22" font-weight="700" font-family="sans-serif">${escapeXml(stat.value)}</text>
      `;
    })
    .join("");

  const rankText = rankParts.length
    ? `<text x="${CARD_PADDING_X}" y="${CARD_PADDING_Y + 16}" fill="#9be7ff" font-size="13" font-weight="600" font-family="sans-serif">${escapeXml(rankParts.join(" • "))}</text>`
    : "";

  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cardGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(86, 214, 255, 0.24)" />
          <stop offset="100%" stop-color="rgba(255, 121, 198, 0.18)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" rx="26" fill="rgba(43,22,76,0.88)" />
      <rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" rx="24.5" fill="none" stroke="url(#cardGlow)" stroke-width="3" />
      ${rankText}
      ${cells}
    </svg>
  `);
}

export async function renderProfileCard(profile, ranks = null) {
  const stats = [
    profile.aura ? { label: "Aura", value: profile.aura } : null,
    profile.joinDate ? { label: "Joined", value: profile.joinDate } : null,
    profile.lastUpdated ? { label: "Updated", value: profile.lastUpdated } : null,
    profile.followers ? { label: "Followers", value: profile.followers } : null,
    profile.following ? { label: "Following", value: profile.following } : null,
    profile.comments ? { label: "Comments", value: profile.comments } : null,
    profile.lists ? { label: "Lists", value: profile.lists } : null,
    profile.reviews ? { label: "Reviews", value: profile.reviews } : null,
    profile.avgSeriesRating ? { label: "Avg Rating", value: profile.avgSeriesRating } : null,
    profile.seriesWatching ? { label: "Watching", value: profile.seriesWatching } : null,
    profile.seriesPlanning ? { label: "Planning", value: profile.seriesPlanning } : null,
    profile.seriesCompleted ? { label: "Completed", value: profile.seriesCompleted } : null
  ].filter(Boolean);

  const gridRows = Math.ceil(stats.length / GRID_COLUMNS);
  const badgeStrip = await renderBadgeStrip(profile.displayedBadges ?? []);
  const badgeMetadata = badgeStrip ? await sharp(badgeStrip).metadata() : null;
  const badgeHeight = badgeMetadata?.height ?? 0;
  const badgeWidth = badgeMetadata?.width ?? 0;
  const gridHeight = HEADER_HEIGHT + HEADER_GAP + gridRows * CELL_HEIGHT + Math.max(0, gridRows - 1) * ROW_GAP;
  const height = CARD_PADDING_Y + gridHeight + (badgeStrip ? BADGE_TOP_GAP + badgeHeight : 0) + CARD_PADDING_Y;
  const composites = [
    {
      input: buildTextSvg({
        width: CARD_WIDTH,
        height,
        profile,
        ranks,
        stats
      }),
      left: 0,
      top: 0
    }
  ];

  if (badgeStrip && badgeMetadata) {
    composites.push({
      input: badgeStrip,
      left: CARD_PADDING_X,
      top: CARD_PADDING_Y + gridHeight + BADGE_TOP_GAP
    });
  }

  return sharp({
    create: {
      width: CARD_WIDTH,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(composites)
    .png()
    .toBuffer();
}
