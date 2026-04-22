const GRAPHQL_URL = "https://www.anime.com/api/graphql";
const PROFILE_URL = "https://www.anime.com/u/";
import { getBadgeIconUrl, getBadgeImageUrl } from "./badgeAssets.js";
import { resolveLocalBadgePath } from "./badgeIcons.js";

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
    year: "2-digit",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export async function fetchAnimeProfile(username) {
  const safeUsername = normalizeUsername(username);
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

  return {
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
}

export async function fetchAnimeListInfo(username, status) {
  const profile = await fetchAnimeProfile(username);

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

  const normalizedStatus = status.toUpperCase();
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

  return {
    username: profile.username,
    profileUrl: profile.profileUrl,
    status: normalizedStatus,
    total: items.length,
    items
  };
}
