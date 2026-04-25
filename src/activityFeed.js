import { getAllLinkedProfiles } from "./profileLinks.js";
import { fetchAnimeProfile } from "./animeProfile.js";
import {
  fetchLinkedUserContentCandidates,
  fetchTrendingDiscussionCandidates,
  fetchTrendingReviewCandidates
} from "./animeActivity.js";
import {
  getActivityFeedConfig,
  getAllActivityFeedConfigs,
  markActivityFeedItemsSeen
} from "./activityFeedStore.js";

const MAX_LINKED_ITEMS_PER_RUN = 5;

function truncate(value, maxLength = 350) {
  if (!value) {
    return value;
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function parseColorByType(sourceType) {
  if (sourceType === "REVIEW") {
    return 0xf28482;
  }

  return 0x6bd6ff;
}

function formatSourceTypeLabel(sourceType) {
  return {
    REVIEW: "Review",
    DISCUSSION: "Episode Discussion",
    GENERAL_DISCUSSION: "Discussion"
  }[sourceType] ?? sourceType;
}

function buildActivityEmbed(item, contextLabel = null) {
  const titleParts = [formatSourceTypeLabel(item.sourceType)];

  if (item.showTitle) {
    titleParts.push(item.showTitle);
  }

  return {
    color: parseColorByType(item.sourceType),
    title: titleParts.join(": "),
    url: item.url,
    description: truncate(item.summary ?? "No summary available."),
    fields: [
      {
        name: "Author",
        value: item.authorName ? `\`@${item.authorName}\`` : "Unknown",
        inline: true
      },
      {
        name: "Reactions",
        value: `${item.reactionCount}`,
        inline: true
      },
      {
        name: "Source",
        value: contextLabel ?? "Anime.com public feed",
        inline: true
      }
    ],
    footer: {
      text: "Data fetched from Anime.com public GraphQL endpoint"
    },
    timestamp: item.publishedAt ?? undefined
  };
}

async function fetchLinkedActivityPool() {
  const linkedProfiles = await getAllLinkedProfiles();
  const animeProfiles = await Promise.allSettled(
    linkedProfiles.map(async ({ discordUserId, username }) => {
      const profile = await fetchAnimeProfile(username);

      if (!profile?.id) {
        return null;
      }

      const items = await fetchLinkedUserContentCandidates(profile.id, 5);

      return items.map((item) => ({
        ...item,
        linkedDiscordUserId: discordUserId,
        linkedUsername: profile.username
      }));
    })
  );

  return animeProfiles
    .filter((result) => result.status === "fulfilled" && Array.isArray(result.value))
    .flatMap((result) => result.value)
    .sort((left, right) => String(right.publishedAt ?? "").localeCompare(String(left.publishedAt ?? "")));
}

function isTextSendableChannel(channel) {
  return Boolean(channel?.isTextBased?.() && channel?.send);
}

export function buildActivityFeedStatusEmbed(config) {
  if (!config) {
    return {
      color: 0xadb5bd,
      title: "Activity Feed",
      description: "No activity feed is configured for this server yet."
    };
  }

  const enabledTypes = [
    config.reviews ? "Trending reviews" : null,
    config.discussions ? "Trending discussions" : null,
    config.linkedUsers ? "Linked-user posts" : null
  ].filter(Boolean);

  return {
    color: 0x8ecae6,
    title: "Activity Feed",
    description: `Channel: <#${config.channelId}>`,
    fields: [
      {
        name: "Enabled Streams",
        value: enabledTypes.length ? enabledTypes.join("\n") : "None",
        inline: false
      }
    ],
    footer: {
      text: "Runs on a recurring background interval"
    }
  };
}

export async function runActivityFeedPass(client, guildId = null) {
  const singleConfig = guildId ? await getActivityFeedConfig(guildId) : null;
  const configs = guildId
    ? singleConfig ? [{ guildId, ...singleConfig }] : []
    : await getAllActivityFeedConfigs();

  if (!configs.length) {
    return { guilds: [], totalPosted: 0 };
  }

  const needsReviews = configs.some((config) => config.reviews);
  const needsDiscussions = configs.some((config) => config.discussions);
  const needsLinkedUsers = configs.some((config) => config.linkedUsers);

  const [reviewCandidates, discussionCandidates, linkedCandidates] = await Promise.all([
    needsReviews ? fetchTrendingReviewCandidates(12) : Promise.resolve([]),
    needsDiscussions ? fetchTrendingDiscussionCandidates(12) : Promise.resolve([]),
    needsLinkedUsers ? fetchLinkedActivityPool() : Promise.resolve([])
  ]);

  const guildSummaries = [];

  for (const config of configs) {
    let channel = null;

    try {
      channel = await client.channels.fetch(config.channelId);
    } catch {
      channel = null;
    }

    if (!isTextSendableChannel(channel)) {
      guildSummaries.push({
        guildId: config.guildId,
        posted: 0,
        skipped: "Channel unavailable"
      });
      continue;
    }

    const seenItems = new Set(config.seenItems ?? []);
    const postedKeys = [];
    let posted = 0;

    if (config.reviews) {
      const candidate = reviewCandidates.find((item) => !seenItems.has(item.key));

      if (candidate) {
        await channel.send({
          embeds: [buildActivityEmbed(candidate, "Trending review")]
        });
        postedKeys.push(candidate.key);
        seenItems.add(candidate.key);
        posted += 1;
      }
    }

    if (config.discussions) {
      const candidate = discussionCandidates.find((item) => !seenItems.has(item.key));

      if (candidate) {
        await channel.send({
          embeds: [buildActivityEmbed(candidate, "Trending discussion")]
        });
        postedKeys.push(candidate.key);
        seenItems.add(candidate.key);
        posted += 1;
      }
    }

    if (config.linkedUsers) {
      const linkedItems = linkedCandidates
        .filter((item) => !seenItems.has(item.key))
        .slice(0, MAX_LINKED_ITEMS_PER_RUN);

      for (const item of linkedItems) {
        await channel.send({
          content: item.linkedDiscordUserId
            ? `New Anime.com activity from <@${item.linkedDiscordUserId}>`
            : undefined,
          embeds: [
            buildActivityEmbed(
              item,
              item.linkedUsername ? `Linked user \`@${item.linkedUsername}\`` : "Linked user activity"
            )
          ]
        });

        postedKeys.push(item.key);
        seenItems.add(item.key);
        posted += 1;
      }
    }

    if (postedKeys.length) {
      await markActivityFeedItemsSeen(config.guildId, postedKeys);
    }

    guildSummaries.push({
      guildId: config.guildId,
      posted,
      skipped: null
    });
  }

  return {
    guilds: guildSummaries,
    totalPosted: guildSummaries.reduce((sum, guild) => sum + guild.posted, 0)
  };
}
