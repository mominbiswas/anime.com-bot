const GRAPHQL_URL = "https://www.anime.com/api/graphql";
const SITE_URL = "https://www.anime.com";
const DEFAULT_PAGE_SIZE = 10;

const GET_PUBLIC_CONTENT_EMBEDDINGS_QUERY = `
  query GetPublicContentEmbeddings(
    $languageCode: String!
    $pagination: PaginationParamsInput
    $filter: ContentEmbeddingFilterInput
  ) {
    getContentEmbeddings: getPublicContentEmbeddings(
      languageCode: $languageCode
      pagination: $pagination
      filter: $filter
    ) {
      edges {
        node {
          id
          sourceType
          sourceId
          summary
          publishedAt
          author
          reactions {
            totalCount
          }
          user {
            id
            username
          }
          entityAssociations {
            ipTitle {
              id
              slug
              showPageSlug
              translation(languageCode: "en") {
                name
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const GET_PUBLIC_USER_POSTS_QUERY = `
  query GetUserPostsPublic(
    $userId: ID!
    $pagination: PaginationParamsInput
    $sourceTypes: [ContentSourceType!]
  ) {
    getPublicUserPosts(
      userId: $userId
      sourceTypes: $sourceTypes
      pagination: $pagination
    ) {
      edges {
        node {
          id
          sourceType
          sourceId
          summary
          publishedAt
          author
          reactions {
            totalCount
          }
          user {
            id
            username
          }
          entityAssociations {
            ipTitle {
              id
              slug
              showPageSlug
              translation(languageCode: "en") {
                name
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

async function fetchAnimeGraphQL({ operationName, query, variables, refererPath = "/" }) {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 (compatible; AnimeComDiscordBot/0.4)",
      origin: SITE_URL,
      referer: `${SITE_URL}${refererPath}`
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

function normalizeReactionCount(item) {
  const value = item?.reactions?.totalCount;
  return Number.isFinite(value) ? value : 0;
}

function buildContentUrl(item) {
  if (item.sourceType === "REVIEW") {
    return `${SITE_URL}/reviews/${item.sourceId ?? item.id}`;
  }

  return `${SITE_URL}/post/${item.sourceId ?? item.id}`;
}

function getPrimaryAssociatedTitle(item) {
  const firstMatch = item.entityAssociations?.find((association) => association?.ipTitle) ?? null;
  return firstMatch?.ipTitle ?? null;
}

function normalizeContentItem(item) {
  const title = getPrimaryAssociatedTitle(item);

  return {
    id: item.id,
    key: `${item.sourceType}:${item.sourceId ?? item.id}`,
    sourceType: item.sourceType,
    summary: item.summary ?? null,
    publishedAt: item.publishedAt ?? null,
    authorName: item.user?.username ?? item.author ?? null,
    reactionCount: normalizeReactionCount(item),
    url: buildContentUrl(item),
    showTitle: title?.translation?.name ?? null,
    showSlug: title?.showPageSlug ?? title?.slug ?? null
  };
}

function sortTrending(items) {
  return [...items].sort((left, right) =>
    right.reactionCount - left.reactionCount ||
    String(right.publishedAt ?? "").localeCompare(String(left.publishedAt ?? ""))
  );
}

function sortNewest(items) {
  return [...items].sort((left, right) =>
    String(right.publishedAt ?? "").localeCompare(String(left.publishedAt ?? ""))
  );
}

async function fetchPublicContentItems(filter, limit = DEFAULT_PAGE_SIZE) {
  const payload = await fetchAnimeGraphQL({
    operationName: "GetPublicContentEmbeddings",
    query: GET_PUBLIC_CONTENT_EMBEDDINGS_QUERY,
    variables: {
      languageCode: "en",
      pagination: { first: limit },
      filter
    }
  });

  return (payload?.getContentEmbeddings?.edges ?? [])
    .map((edge) => edge?.node)
    .filter(Boolean)
    .map(normalizeContentItem);
}

export async function fetchTrendingReviewCandidates(limit = DEFAULT_PAGE_SIZE) {
  const items = await fetchPublicContentItems({
    sourceTypes: ["REVIEW"]
  }, limit);

  return sortTrending(items);
}

export async function fetchTrendingDiscussionCandidates(limit = DEFAULT_PAGE_SIZE) {
  const items = await fetchPublicContentItems({
    discussionsOnly: true
  }, limit);

  return sortTrending(items);
}

export async function fetchLinkedUserContentCandidates(userId, limit = DEFAULT_PAGE_SIZE) {
  const payload = await fetchAnimeGraphQL({
    operationName: "GetUserPostsPublic",
    query: GET_PUBLIC_USER_POSTS_QUERY,
    variables: {
      userId,
      pagination: { first: limit },
      sourceTypes: ["REVIEW", "DISCUSSION", "GENERAL_DISCUSSION"]
    }
  });

  const items = (payload?.getPublicUserPosts?.edges ?? [])
    .map((edge) => edge?.node)
    .filter(Boolean)
    .map(normalizeContentItem);

  return sortNewest(items);
}
