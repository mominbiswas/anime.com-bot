import sharp from "sharp";

const CELL_WIDTH = 200;
const CELL_HEIGHT = 118;
const ICON_SIZE = 68;
const PADDING = 24;
const TITLE_HEIGHT = 58;
const COLUMNS = 3;

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapLabel(value, maxChars = 18) {
  const words = value.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 2);
}

async function fetchBadgeIcon(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; AnimeComDiscordBot/0.3)"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch badge icon: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function buildTextSvg({ width, height, title, subtitleLines }) {
  const subtitle = subtitleLines
    .map(
      (line, index) =>
        `<text x="100" y="${86 + index * 18}" text-anchor="middle" font-size="14" fill="#f5f7fb" font-family="Arial, sans-serif">${escapeXml(line)}</text>`
    )
    .join("");

  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="18" fill="#161b29"/>
      <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="17" fill="none" stroke="#2d3650"/>
      <text x="100" y="30" text-anchor="middle" font-size="16" font-weight="700" fill="#ffffff" font-family="Arial, sans-serif">${escapeXml(title)}</text>
      ${subtitle}
    </svg>`
  );
}

export async function renderBadgeSheet({ title, badges }) {
  const items = badges.slice(0, 12);

  if (!items.length) {
    return null;
  }

  const rows = Math.ceil(items.length / COLUMNS);
  const width = PADDING * 2 + COLUMNS * CELL_WIDTH + (COLUMNS - 1) * 16;
  const height = TITLE_HEIGHT + PADDING * 2 + rows * CELL_HEIGHT + (rows - 1) * 16;

  const base = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#0b1020"
    }
  });

  const composites = [];

  const titleSvg = Buffer.from(
    `<svg width="${width}" height="${TITLE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <text x="${width / 2}" y="34" text-anchor="middle" font-size="28" font-weight="700" fill="#ffffff" font-family="Arial, sans-serif">${escapeXml(title)}</text>
    </svg>`
  );

  composites.push({ input: titleSvg, top: 10, left: 0 });

  for (let index = 0; index < items.length; index += 1) {
    const badge = items[index];
    const row = Math.floor(index / COLUMNS);
    const column = index % COLUMNS;
    const left = PADDING + column * (CELL_WIDTH + 16);
    const top = TITLE_HEIGHT + PADDING + row * (CELL_HEIGHT + 16);
    const textSvg = buildTextSvg({
      width: CELL_WIDTH,
      height: CELL_HEIGHT,
      title: badge.name,
      subtitleLines: wrapLabel(badge.description || badge.key)
    });

    composites.push({ input: textSvg, left, top });

    try {
      const iconBuffer = await fetchBadgeIcon(badge.iconUrl);
      const resizedIcon = await sharp(iconBuffer)
        .resize(ICON_SIZE, ICON_SIZE, { fit: "contain" })
        .png()
        .toBuffer();

      composites.push({
        input: resizedIcon,
        left: left + Math.round((CELL_WIDTH - ICON_SIZE) / 2),
        top: top + 36
      });
    } catch {
      // If a single icon fails, the rest of the sheet still renders.
    }
  }

  return base.composite(composites).png().toBuffer();
}
