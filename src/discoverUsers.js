const GRAPHQL_URL = "https://www.anime.com/api/graphql";
const SHOW_URL = "https://www.anime.com/shows/";
const MAX_REVIEW_PAGES = 10;
const REVIEWS_PER_PAGE = 50;

const GET_POPULATED_IP_TITLE_BY_SLUG_QUERY = `
  query GetPopulatedIpTitleBySlug(
    $ipIdInput: IpIdInput!
    $languageCode: String!
    $countryCode: String
  ) {
    populatedIpTitle(
      ipIdInput: $ipIdInput
      languageCode: $languageCode
      countryCode: $countryCode
    ) {
      id
      slug
    }
  }
`;

const GET_IP_REVIEWS_QUERY = `
  query GetIpReviews(
    $ipEntityType: IpEntityType!
    $ipEntityId: ID!
    $pagination: PaginationParamsInput
  ) {
    getIpReviews(
      ipEntityType: $ipEntityType
      ipEntityId: $ipEntityId
      pagination: $pagination
    ) {
      edges {
        node {
          id
          user {
            username
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

async function fetchAnimeGraphQL({ operationName, query, variables, refererPath }) {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 (compatible; AnimeComDiscordBot/0.3)",
      origin: "https://www.anime.com",
      referer: `https://www.anime.com${refererPath}`
    },
    body: JSON.stringify({
      operationName,
      query,
      variables
    })
  });

  if (!response.ok) {
    throw new Error(`Anime.com returned ${response.status}`);
  }

  const payload = await response.json();

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message || `Anime.com ${operationName} request failed`);
  }

  return payload.data;
}

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

async function fetchShowTitleId(showSlug) {
  const payload = await fetchAnimeGraphQL({
    operationName: "GetPopulatedIpTitleBySlug",
    query: GET_POPULATED_IP_TITLE_BY_SLUG_QUERY,
    variables: {
      ipIdInput: { slug: showSlug },
      languageCode: "en",
      countryCode: "US"
    },
    refererPath: `/shows/${encodeURIComponent(showSlug)}`
  });

  return payload?.populatedIpTitle?.id ?? null;
}

async function fetchReviewUsernames(showSlug) {
  const titleId = await fetchShowTitleId(showSlug);

  if (!titleId) {
    return [];
  }

  const usernames = [];
  let after = null;

  for (let page = 0; page < MAX_REVIEW_PAGES; page += 1) {
    const payload = await fetchAnimeGraphQL({
      operationName: "GetIpReviews",
      query: GET_IP_REVIEWS_QUERY,
      variables: {
        ipEntityType: "IP_TITLE",
        ipEntityId: titleId,
        pagination: after
          ? { first: REVIEWS_PER_PAGE, after }
          : { first: REVIEWS_PER_PAGE }
      },
      refererPath: `/shows/${encodeURIComponent(showSlug)}`
    });

    const result = payload?.getIpReviews;
    const edges = result?.edges ?? [];

    usernames.push(
      ...edges
        .map((edge) => edge?.node?.user?.username)
        .filter(Boolean)
    );

    if (!result?.pageInfo?.hasNextPage || !result.pageInfo.endCursor) {
      break;
    }

    after = result.pageInfo.endCursor;
  }

  return dedupeUsernames(usernames);
}

export async function discoverPublicUsernames(showSlug, source = "all") {
  const safeSlug = showSlug.trim().replace(/^\/+|\/+$/g, "");
  const url = `${SHOW_URL}${encodeURIComponent(safeSlug)}`;
  const needsHtml = source !== "reviews";
  const needsReviews = source !== "discussions";
  let htmlUsernames = [];
  let reviewUsernames = [];

  if (needsReviews) {
    try {
      reviewUsernames = await fetchReviewUsernames(safeSlug);
    } catch {
      reviewUsernames = [];
    }
  }

  if (needsHtml || (source === "reviews" && reviewUsernames.length === 0)) {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; AnimeComDiscordBot/0.3)"
      }
    });

    if (!response.ok) {
      throw new Error(`Anime.com returned ${response.status}`);
    }

    const html = await response.text();
    const relevantHtml = extractRelevantHtml(html, source);
    htmlUsernames = extractUsernamesFromHtml(relevantHtml);
  }

  const usernames = dedupeUsernames([...reviewUsernames, ...htmlUsernames]);

  return {
    showSlug: safeSlug,
    source,
    url,
    usernames
  };
}
