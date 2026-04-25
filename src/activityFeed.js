import { getAllLinkedProfiles } from "./profileLinks.js";
import { fetchAnimeProfile } from "./animeProfile.js";
import {
  ACTIVITY_SOURCE_CONFIG,
  fetchLinkedUserContentCandidates,
  fetchTrendingCandidatesByType
} from "./animeActivity.js";
import {
  getActivityFeedConfig,
  getAllActivityFeedConfigs,
  markActivityFeedItemsSeen
} from "./activityFeedStore.js";

const MAX_LINKED_ITEMS_PER_RUN = 5;
const FEED_TYPE_KEYS = ["reviews", "discussions", "episodeDiscussions", "memes", "polls", "news"];

function parseColorByType(sourceType) {
  if (sourceType === "REVIEW") {
    return 0xf28482;
  }

  if (sourceType === "MEME") {
    return 0xf4d35e;
  }

  if (sourceType === "POLL") {
    return 0x90be6d;
  }

  if (sourceType === "INTERNAL") {
    return 0xcdb4db;
  }

  return 0x6bd6ff;
}

function formatSourceTypeLabel(sourceType) {
  return {
    REVIEW: "Review",
    DISCUSSION: "Episode Discussion",
    GENERAL_DISCUSSION: "Discussion",
    MEME: "Meme",
    POLL: "Poll",
    INTERNAL: "News",
    INTERNAL_EVENT: "Event"
  }[sourceType] ?? sourceType;
}

function buildActivityEmbed(item) {
  return {
    color: parseColorByType(item.sourceType),
    fields: [
      {
        name: "Type",
        value: formatSourceTypeLabel(item.sourceType),
        inline: true
      },
      {
        name: "Author",
        value: item.authorName ? `\`@${item.authorName}\`` : "Unknown",
        inline: true
      },
      {
        name: "Reactions",
        value: `${item.reactionCount}`,
        inline: true
      }
    ]
  };
}

function getEnabledFeedTypeKeys(config) {
  return FEED_TYPE_KEYS.filter((key) => config[key]);
}

function mapFeedTypeToLinkedSourceTypes(feedTypeKeys) {
  const sourceTypes = new Set();

  for (const key of feedTypeKeys) {
    if (key === "news") {
      continue;
    }

    for (const sourceType of ACTIVITY_SOURCE_CONFIG[key]?.sourceTypes ?? []) {
      sourceTypes.add(sourceType);
    }
  }

  return [...sourceTypes];
}

async function fetchLinkedActivityPool(sourceTypes) {
  const linkedProfiles = await getAllLinkedProfiles();
  const animeProfiles = await Promise.allSettled(
    linkedProfiles.map(async ({ discordUserId, username }) => {
      const profile = await fetchAnimeProfile(username);

      if (!profile?.id) {
        return null;
      }

      const items = await fetchLinkedUserContentCandidates(profile.id, sourceTypes, 5);

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
    config.episodeDiscussions ? "Trending episode discussions" : null,
    config.memes ? "Trending memes" : null,
    config.polls ? "Trending polls" : null,
    config.news ? "Trending news" : null,
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

  const enabledTypeKeys = [...new Set(configs.flatMap(getEnabledFeedTypeKeys))];
  const linkedSourceTypes = mapFeedTypeToLinkedSourceTypes(enabledTypeKeys);
  const needsLinkedUsers = configs.some((config) => config.linkedUsers);

  const typeCandidateEntries = await Promise.all(
    enabledTypeKeys.map(async (typeKey) => [typeKey, await fetchTrendingCandidatesByType(typeKey, 12)])
  );
  const candidateMap = Object.fromEntries(typeCandidateEntries);
  const linkedCandidates = needsLinkedUsers && linkedSourceTypes.length
    ? await fetchLinkedActivityPool(linkedSourceTypes)
    : [];

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

    for (const typeKey of getEnabledFeedTypeKeys(config)) {
      const candidate = (candidateMap[typeKey] ?? []).find((item) => !seenItems.has(item.key));

      if (candidate) {
        await channel.send({
          embeds: [buildActivityEmbed(candidate)]
        });
        await channel.send(candidate.url);
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
          content: item.linkedDiscordUserId ? `New Anime.com activity from <@${item.linkedDiscordUserId}>` : undefined,
          embeds: [buildActivityEmbed(item)]
        });
        await channel.send(item.url);

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
