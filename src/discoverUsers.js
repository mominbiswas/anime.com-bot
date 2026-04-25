const SHOW_URL = "https://www.anime.com/shows/";

function dedupeUsernames(usernames) {
  const seen = new Set();
  const results = [];

  for (const username of usernames) {
    const normalized = username.toLowerCase();

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    results.push(username);
  }

  return results;
}

function extractRelevantHtml(html, source) {
  if (source === "all") {
    return html;
  }

  const markers = {
    reviews: "Reviews",
    discussions: "Discussions"
  };
  const marker = markers[source];

  if (!marker) {
    return html;
  }

  const markerIndex = html.indexOf(marker);

  if (markerIndex < 0) {
    return html;
  }

  return html.slice(markerIndex, markerIndex + 120000);
}

function extractUsernamesFromHtml(html) {
  const matches = [...html.matchAll(/\/u\/([a-zA-Z0-9_-]+)/g)];
  return dedupeUsernames(matches.map((match) => decodeURIComponent(match[1])));
}

export async function discoverPublicUsernames(showSlug, source = "all") {
  const safeSlug = showSlug.trim().replace(/^\/+|\/+$/g, "");
  const url = `${SHOW_URL}${encodeURIComponent(safeSlug)}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; AnimeComDiscordBot/0.2)"
    }
  });

  if (!response.ok) {
    throw new Error(`Anime.com returned ${response.status}`);
  }

  const html = await response.text();
  const relevantHtml = extractRelevantHtml(html, source);
  const usernames = extractUsernamesFromHtml(relevantHtml);

  return {
    showSlug: safeSlug,
    source,
    url,
    usernames
  };
}
