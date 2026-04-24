const GRAPHQL_URL = "https://www.anime.com/api/graphql";
const PROFILE_URL = "https://www.anime.com/u/";
import { getBadgeIconUrl, getBadgeImageUrl } from "./badgeAssets.js";
import { resolveLocalBadgePath } from "./badgeIcons.js";

const CACHE_TTL_MS = Number.parseInt(process.env.ANIME_CACHE_TTL_MS ?? "120000", 10);
const profileCache = new Map();
const listCache = new Map();
const inflightProfileRequests = new Map();
const inflightListRequests = new Map();

const GET_PUBLIC_USER_PROFILE_QUERY = `
  query GetPublicUserProfile($username: String!) {
    publicUserByUsername(username: $username) {
      id
      username
      profile {
        id
        bio
      }
      pfpUrl
      pfpBackgroundColorHex
      createdAt
      updatedAt
      followerCount
      followingCount
      stats {
        id
        aura
        totalComments
        totalReviews
        totalLists
      }
      earnedBadges {
        key
        name
        description
        tier
        badgeFamily
      }
      featuredBadges {
        key
        name
      }
    }
  }
`;

const GET_WATCHLIST_SUMMARY_BY_USER_ID_QUERY = `
  query GetWatchListByUserId($languageCode: String!, $userId: ID!) {
    watchListByUserId(languageCode: $languageCode, userId: $userId) {
      id
      items {
        status
        rating
      }
    }
  }
`;

const GET_WATCHLIST_BY_USER_ID_QUERY = `
  query GetWatchListByUserId($languageCode: String!, $userId: ID!) {
    watchListByUserId(languageCode: $languageCode, userId: $userId) {
      id
      items {
        id
        status
        rating
        updatedAt
        ipTitle {
          id
          slug
          showPageSlug
          translation(languageCode: $languageCode) {
            id
            name
            posterImageUrl
          }
        }
      }
    }
  }
`;

async function fetchAnimeGraphQL({ operationName, variables, query, refererUsername, allowPartialData = false }) {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 (compatible; AnimeComDiscordBot/0.2)",
      origin: "https://www.anime.com",
      referer: `${PROFILE_URL}${encodeURIComponent(refererUsername)}`
    },
    body: JSON.stringify({
      operationName,
      variables,
      query
    })
  });

  if (!response.ok) {
    throw new Error(`Anime.com returned ${response.status}`);
  }

  const payload = await response.json();

  if (payload.errors?.length && !(allowPartialData && payload.data)) {
    throw new Error(payload.errors[0]?.message || `Anime.com ${operationName} request failed`);
  }

  return payload.data;
}

function normalizeUsername(username) {
  return username.trim().replace(/^@/, "");
}

function getValidCacheEntry(cache, key) {
  const cached = cache.get(key);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.value;
}

function setCacheEntry(cache, key, value) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function normalizeBadgeName(badge) {
  if (!badge) {
    return null;
  }

  return badge.tier ? `${badge.name} (T${badge.tier})` : badge.name;
}

function selectDisplayedBadges(badges) {
  const bestByFamily = new Map();

  for (const badge of badges ?? []) {
    const family = badge.badgeFamily ?? badge.key;
    const current = bestByFamily.get(family);
    const nextTier = badge.tier ?? 0;
    const currentTier = current?.tier ?? 0;

    if (!current || nextTier > currentTier) {
      bestByFamily.set(family, badge);
    }
  }

  return [...bestByFamily.values()];
}

function buildBadgeSummary(profile) {
  const featured = (profile.featuredBadges ?? []).map((badge) => badge.name);
  const earned = selectDisplayedBadges(profile.earnedBadges ?? [])
    .map(normalizeBadgeName)
    .filter(Boolean);
  const combined = [...featured, ...earned];

  return [...new Set(combined)];
}

export function formatDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

export async function fetchAnimeProfile(username) {
  const safeUsername = normalizeUsername(username);
  const cachedProfile = getValidCacheEntry(profileCache, safeUsername.toLowerCase());

  if (cachedProfile) {
    return cachedProfile;
  }

  const inflightProfile = inflightProfileRequests.get(safeUsername.toLowerCase());

  if (inflightProfile) {
    return inflightProfile;
  }

  const request = (async () => {
  const profileData = await fetchAnimeGraphQL({
    operationName: "GetPublicUserProfile",
    variables: {
      username: safeUsername
    },
    query: GET_PUBLIC_USER_PROFILE_QUERY,
    refererUsername: safeUsername
  });

  const profile = profileData?.publicUserByUsername;

  if (!profile) {
    return null;
  }

  const displayedEarnedBadges = selectDisplayedBadges(profile.earnedBadges ?? []);
  let completedCount = null;
  let watchingCount = null;
  let planningCount = null;
  let droppedCount = null;
  let avgSeriesRating = null;

  try {
    const watchlistData = await fetchAnimeGraphQL({
      operationName: "GetWatchListByUserId",
      variables: {
        languageCode: "en",
        userId: profile.id
      },
      query: GET_WATCHLIST_SUMMARY_BY_USER_ID_QUERY,
      refererUsername: safeUsername
    });

    const watchlistItems = watchlistData?.watchListByUserId?.items ?? [];
    completedCount = watchlistItems.filter((item) => item.status === "COMPLETED").length;
    watchingCount = watchlistItems.filter((item) => item.status === "WATCHING").length;
    planningCount = watchlistItems.filter((item) => item.status === "PLANNING").length;
    droppedCount = watchlistItems.filter((item) => item.status === "DROPPED").length;
    const numericRatings = watchlistItems
      .map((item) => item.rating)
      .filter((value) => typeof value === "number");
    avgSeriesRating = numericRatings.length
      ? (numericRatings.reduce((sum, value) => sum + value, 0) / numericRatings.length).toFixed(1)
      : null;
  } catch {
    // Some users appear to trigger slow or unavailable watchlist responses.
    // Keep the public profile visible even if watchlist summary fails.
  }

  const result = {
    id: profile.id,
    username: profile.username,
    name: profile.username,
    bio: profile.profile?.bio ?? null,
    profileUrl: `${PROFILE_URL}${encodeURIComponent(profile.username)}`,
    avatarUrl: profile.pfpUrl ?? null,
    accentColor: profile.pfpBackgroundColorHex ?? null,
    createdAt: profile.createdAt ?? null,
    updatedAt: profile.updatedAt ?? null,
    joinDate: formatDate(profile.createdAt),
    lastUpdated: formatDate(profile.updatedAt),
    followers: profile.followerCount?.toString() ?? null,
    following: profile.followingCount?.toString() ?? null,
    aura: profile.stats?.aura?.toString() ?? null,
    comments: profile.stats?.totalComments?.toString() ?? null,
    reviews: profile.stats?.totalReviews?.toString() ?? null,
    lists: profile.stats?.totalLists?.toString() ?? null,
    seriesCompleted: completedCount?.toString() ?? null,
    seriesWatching: watchingCount?.toString() ?? null,
    seriesPlanning: planningCount?.toString() ?? null,
    seriesDropped: droppedCount?.toString() ?? null,
    avgSeriesRating,
    badges: buildBadgeSummary(profile),
    featuredBadges: (profile.featuredBadges ?? []).map((badge) => ({
      key: badge.key,
      name: badge.name,
      iconUrl: getBadgeIconUrl(badge.key),
      imageUrl: getBadgeImageUrl(badge.key),
      localFilePath: resolveLocalBadgePath(badge.key)
    })),
    earnedBadges: (profile.earnedBadges ?? []).map((badge) => ({
      key: badge.key,
      name: normalizeBadgeName(badge),
      rawName: badge.name ?? null,
      description: badge.description ?? null,
      tier: badge.tier ?? null,
      badgeFamily: badge.badgeFamily ?? null,
      iconUrl: getBadgeIconUrl(badge.key),
      imageUrl: getBadgeImageUrl(badge.key),
      localFilePath: resolveLocalBadgePath(badge.key)
    })),
    displayedBadges: displayedEarnedBadges.map((badge) => ({
      key: badge.key,
      name: normalizeBadgeName(badge),
      rawName: badge.name ?? null,
      description: badge.description ?? null,
      tier: badge.tier ?? null,
      badgeFamily: badge.badgeFamily ?? null,
      iconUrl: getBadgeIconUrl(badge.key),
      imageUrl: getBadgeImageUrl(badge.key),
      localFilePath: resolveLocalBadgePath(badge.key)
    }))
  };
  setCacheEntry(profileCache, safeUsername.toLowerCase(), result);
  setCacheEntry(profileCache, profile.username.toLowerCase(), result);
  return result;
  })();

  inflightProfileRequests.set(safeUsername.toLowerCase(), request);

  try {
    return await request;
  } finally {
    inflightProfileRequests.delete(safeUsername.toLowerCase());
  }
}

export async function fetchAnimeListInfo(username, status) {
  const safeUsername = normalizeUsername(username);
  const normalizedStatus = status.toUpperCase();
  const cacheKey = `${safeUsername.toLowerCase()}:${normalizedStatus}`;
  const cachedList = getValidCacheEntry(listCache, cacheKey);

  if (cachedList) {
    return cachedList;
  }

  const inflightList = inflightListRequests.get(cacheKey);

  if (inflightList) {
    return inflightList;
  }

  const request = (async () => {
  const profile = await fetchAnimeProfile(safeUsername);

  if (!profile) {
    return null;
  }

  const watchlistData = await fetchAnimeGraphQL({
    operationName: "GetWatchListByUserId",
    variables: {
      languageCode: "en",
      userId: profile.id
    },
    query: GET_WATCHLIST_BY_USER_ID_QUERY,
    refererUsername: profile.username,
    allowPartialData: true
  });

  const items = (watchlistData?.watchListByUserId?.items ?? [])
    .filter((item) => item.status === normalizedStatus && item.ipTitle)
    .map((item) => ({
      id: item.id ?? `${item.ipTitle?.showPageSlug ?? item.ipTitle?.slug ?? item.updatedAt}`,
      status: item.status,
      rating: item.rating,
      updatedAt: item.updatedAt,
      title: item.ipTitle?.translation?.name ?? item.ipTitle?.slug ?? "Unknown title",
      slug: item.ipTitle?.showPageSlug ?? item.ipTitle?.slug ?? null
    }))
    .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""));

  const result = {
    username: profile.username,
    profileUrl: profile.profileUrl,
    status: normalizedStatus,
    total: items.length,
    items
  };
  setCacheEntry(listCache, cacheKey, result);
  return result;
  })();

  inflightListRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    inflightListRequests.delete(cacheKey);
  }
}
