import "dotenv/config";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import { fetchAnimeListInfo, fetchAnimeProfile } from "./animeProfile.js";
import { renderBadgeIcon } from "./badgeIcons.js";
import { renderBadgeStrip } from "./badgeStrip.js";
import {
  getAllForcedUnlinkedUsernames,
  getPendingLink,
  getAllLinkedProfiles,
  getLinkedUsername,
  markUsernameForcedUnlinked,
  removePendingLink,
  removeLinkedUsername,
  setPendingLink,
  setLinkedUsername
} from "./profileLinks.js";
import {
  addTrackedUsername,
  getTrackedUsernames,
  removeTrackedUsername
} from "./trackedProfiles.js";

const token = process.env.DISCORD_TOKEN;
const allowedUntrackUserIds = new Set(
  (process.env.UNTRACK_ALLOWED_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

if (!token) {
  throw new Error("Missing DISCORD_TOKEN in environment.");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function parseColor(hex) {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) {
    return 0xe85d75;
  }

  return Number.parseInt(hex.replace("#", ""), 16);
}

function truncate(value, maxLength = 1024) {
  if (!value) {
    return value;
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function generateVerificationCode() {
  return `DC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function buildBadgeAttachments(badges, prefix) {
  const items = badges.filter((badge) => badge.localFilePath).slice(0, 10);
  const files = [];

  for (let index = 0; index < items.length; index += 1) {
    const badge = items[index];
    const buffer = await renderBadgeIcon(badge.localFilePath);
    files.push(
      new AttachmentBuilder(buffer, {
        name: `${prefix}-${index + 1}-${badge.key}.png`
      })
    );
  }

  return files;
}

function formatRank(rank) {
  return rank ? `Rank #${rank}` : "Unranked";
}

function buildProfileEmbed(profile, ranks = null) {
  const auraValue = profile.aura
    ? ranks?.aura
      ? `${profile.aura} | ${formatRank(ranks.aura)}`
      : profile.aura
    : null;
  const followersValue = profile.followers
    ? ranks?.followers
      ? `${profile.followers} | ${formatRank(ranks.followers)}`
      : profile.followers
    : null;
  const fields = [
    auraValue ? { name: "Aura", value: auraValue, inline: true } : null,
    profile.joinDate ? { name: "Joined", value: profile.joinDate, inline: true } : null,
    profile.lastUpdated ? { name: "Updated", value: profile.lastUpdated, inline: true } : null,
    followersValue ? { name: "Followers", value: followersValue, inline: true } : null,
    profile.following ? { name: "Following", value: profile.following, inline: true } : null,
    profile.comments ? { name: "Comments", value: profile.comments, inline: true } : null,
    profile.lists ? { name: "Lists", value: profile.lists, inline: true } : null,
    profile.reviews ? { name: "Reviews", value: profile.reviews, inline: true } : null,
    profile.seriesCompleted ? { name: "Series Completed", value: profile.seriesCompleted, inline: true } : null,
    profile.seriesWatching ? { name: "Series Watching", value: profile.seriesWatching, inline: true } : null,
    profile.avgSeriesRating ? { name: "Avg Series Rating", value: profile.avgSeriesRating, inline: true } : null
  ].filter(Boolean);

  return {
    color: parseColor(profile.accentColor),
    title: profile.name,
    url: profile.profileUrl,
    description:
      profile.bio || `Public Anime.com profile for @${profile.username}.`,
    fields,
    thumbnail: profile.avatarUrl ? { url: profile.avatarUrl } : undefined,
    footer: {
      text: "Data fetched from Anime.com public GraphQL endpoint"
    }
  };
}

function buildRawPayload(profile) {
  return {
    id: profile.id,
    username: profile.username,
    bio: profile.bio,
    profileUrl: profile.profileUrl,
    avatarUrl: profile.avatarUrl,
    accentColor: profile.accentColor,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    followerCount: profile.followers ? Number(profile.followers) : null,
    followingCount: profile.following ? Number(profile.following) : null,
    stats: {
      aura: profile.aura ? Number(profile.aura) : null,
      totalComments: profile.comments ? Number(profile.comments) : null,
      totalReviews: profile.reviews ? Number(profile.reviews) : null,
      totalLists: profile.lists ? Number(profile.lists) : null,
      seriesCompleted: profile.seriesCompleted ? Number(profile.seriesCompleted) : null,
      seriesWatching: profile.seriesWatching ? Number(profile.seriesWatching) : null,
      avgSeriesRating: profile.avgSeriesRating ? Number(profile.avgSeriesRating) : null
    },
    featuredBadges: profile.featuredBadges,
    earnedBadges: profile.earnedBadges.map((badge) => ({
      key: badge.key,
      name: badge.name,
      rawName: badge.rawName,
      description: badge.description,
      tier: badge.tier,
      badgeFamily: badge.badgeFamily
    }))
  };
}

function buildBadgeInfo(profile, badgeQuery) {
  const normalizedQuery = badgeQuery.trim().toLowerCase();
  const matches = profile.earnedBadges.filter((badge) =>
    badge.name?.toLowerCase().includes(normalizedQuery) ||
    badge.key?.toLowerCase().includes(normalizedQuery) ||
    badge.description?.toLowerCase().includes(normalizedQuery)
  );

  if (!matches.length) {
    return null;
  }

  return {
    color: parseColor(profile.accentColor),
    title: `Badges for @${profile.username}`,
    url: profile.profileUrl,
    description: `Matches for \`${badgeQuery}\` on Anime.com.`,
    fields: matches.slice(0, 10).map((badge) => ({
      name: badge.name || badge.key,
      value: truncate(badge.description || "No description available."),
      inline: false
    })),
    thumbnail: profile.avatarUrl ? { url: profile.avatarUrl } : undefined,
    footer: {
      text: `${matches.length} matching badge${matches.length === 1 ? "" : "s"}`
    }
  };
}

function formatStatusLabel(status) {
  return {
    COMPLETED: "Completed",
    PLANNING: "Planning",
    WATCHING: "Watching",
    DROPPED: "Dropped"
  }[status] ?? status;
}

function buildListInfoCustomId({ username, status, page, perPage }) {
  return `listinfo:${encodeURIComponent(username)}:${status}:${page}:${perPage}`;
}

function buildListInfoJumpCustomId({ username, status, perPage }) {
  return `listjump:${encodeURIComponent(username)}:${status}:${perPage}`;
}

function parseListInfoCustomId(customId) {
  const parts = customId.split(":");

  if (parts.length !== 5 || parts[0] !== "listinfo") {
    return null;
  }

  return {
    username: decodeURIComponent(parts[1]),
    status: parts[2],
    page: Number(parts[3]),
    perPage: Number(parts[4])
  };
}

function parseListInfoJumpCustomId(customId) {
  const parts = customId.split(":");

  if (parts.length !== 4 || parts[0] !== "listjump") {
    return null;
  }

  return {
    username: decodeURIComponent(parts[1]),
    status: parts[2],
    perPage: Number(parts[3])
  };
}

function buildListInfoEmbed(listInfo, page, perPage) {
  const start = page * perPage;
  const visibleItems = listInfo.items.slice(start, start + perPage);
  const lines = visibleItems.map((item, index) => {
    const ratingSuffix = typeof item.rating === "number" ? ` | Rating: ${item.rating}` : "";
    return `${start + index + 1}. ${item.title}${ratingSuffix}`;
  });
  const totalPages = Math.max(1, Math.ceil(listInfo.total / perPage));

  return {
    color: 0x4cc9f0,
    title: `${formatStatusLabel(listInfo.status)} List`,
    url: listInfo.profileUrl,
    description: `@${listInfo.username} has ${listInfo.total} anime in ${formatStatusLabel(listInfo.status).toLowerCase()}.`,
    fields: [
      {
        name: "Anime",
        value: lines.length ? truncate(lines.join("\n"), 1024) : "No entries found.",
        inline: false
      }
    ],
    footer: {
      text: `Page ${page + 1}/${totalPages} | Showing ${visibleItems.length ? start + 1 : 0}-${Math.min(start + visibleItems.length, listInfo.total)} of ${listInfo.total}`
    }
  };
}

function buildListInfoComponents(listInfo, page, perPage) {
  const totalPages = Math.max(1, Math.ceil(listInfo.total / perPage));

  if (totalPages <= 1) {
    return [];
  }

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(buildListInfoCustomId({
          username: listInfo.username,
          status: listInfo.status,
          page: page - 1,
          perPage
        }))
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId(buildListInfoCustomId({
          username: listInfo.username,
          status: listInfo.status,
          page: page + 1,
          perPage
        }))
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1),
      new ButtonBuilder()
        .setCustomId(buildListInfoJumpCustomId({
          username: listInfo.username,
          status: listInfo.status,
          perPage
        }))
        .setLabel("Jump")
        .setStyle(ButtonStyle.Primary)
    )
  ];
}

function buildLeaderboardCustomId({ metric, page, perPage, guildId }) {
  return `leaderboard:${metric}:${page}:${perPage}:${guildId ?? "noguild"}`;
}

function buildLeaderboardJumpCustomId({ metric, perPage, guildId }) {
  return `leaderboardjump:${metric}:${perPage}:${guildId ?? "noguild"}`;
}

function parseLeaderboardCustomId(customId) {
  const parts = customId.split(":");

  if (parts.length !== 5 || parts[0] !== "leaderboard") {
    return null;
  }

  return {
    metric: parts[1],
    page: Number(parts[2]),
    perPage: Number(parts[3]),
    guildId: parts[4] === "noguild" ? null : parts[4]
  };
}

function parseLeaderboardJumpCustomId(customId) {
  const parts = customId.split(":");

  if (parts.length !== 4 || parts[0] !== "leaderboardjump") {
    return null;
  }

  return {
    metric: parts[1],
    perPage: Number(parts[2]),
    guildId: parts[3] === "noguild" ? null : parts[3]
  };
}

function parseMetricValue(profile, metric) {
  const rawValue = profile[metric];

  if (rawValue == null) {
    return null;
  }

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatMetricLabel(metric) {
  return {
    aura: "Aura",
    followers: "Followers"
  }[metric] ?? metric;
}

function canUseUntrack(interaction) {
  return Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
    allowedUntrackUserIds.has(interaction.user.id)
  );
}

function buildLeaderboardEmbed(metric, rows, totalUsers, page, perPage) {
  const metricLabel = formatMetricLabel(metric);
  const start = page * perPage;
  const visibleRows = rows.slice(start, start + perPage);
  const lines = visibleRows.map((row, index) =>
    row.discordUserId
      ? `**${start + index + 1}.** <@${row.discordUserId}>  |  \`${row.value}\` ${metricLabel.toLowerCase()}  |  \`@${row.username}\``
      : `**${start + index + 1}.** \`@${row.username}\`  |  \`${row.value}\` ${metricLabel.toLowerCase()}`
  );
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));

  return {
    color: 0xf4d35e,
    title: `${metricLabel} Leaderboard`,
    description: lines.join("\n"),
    footer: {
      text: `Page ${page + 1}/${totalPages} | Showing ${visibleRows.length ? start + 1 : 0}-${Math.min(start + visibleRows.length, rows.length)} of ${totalUsers} linked and tracked users`
    }
  };
}

function buildLeaderboardComponents(metric, rows, page, perPage, guildId) {
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));

  if (totalPages <= 1) {
    return [];
  }

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(buildLeaderboardCustomId({
          metric,
          page: page - 1,
          perPage,
          guildId
        }))
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId(buildLeaderboardCustomId({
          metric,
          page: page + 1,
          perPage,
          guildId
        }))
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1),
      new ButtonBuilder()
        .setCustomId(buildLeaderboardJumpCustomId({
          metric,
          perPage,
          guildId
        }))
        .setLabel("Jump")
        .setStyle(ButtonStyle.Primary)
    )
  ];
}

async function fetchLeaderboardRows(metric, guildId) {
  const leaderboardProfiles = await fetchLeaderboardProfiles(guildId);

  return {
    totalUsers: leaderboardProfiles.totalUsers,
    rows: leaderboardProfiles.rows
      .filter((row) => row[metric] != null)
      .map((row) => ({
        discordUserId: row.discordUserId,
        username: row.username,
        value: row[metric]
      }))
      .sort((left, right) => right.value - left.value)
  };
}

async function fetchLeaderboardProfiles(guildId) {
  const linkedProfiles = await getAllLinkedProfiles();
  const forcedUnlinkedUsernames = new Set(await getAllForcedUnlinkedUsernames());
  const trackedUsernames = await getTrackedUsernames();
  const mergedProfiles = new Map();

  for (const { discordUserId, username } of linkedProfiles) {
    if (forcedUnlinkedUsernames.has(username.toLowerCase())) {
      continue;
    }

    mergedProfiles.set(username.toLowerCase(), {
      discordUserId,
      username
    });
  }

  for (const username of trackedUsernames) {
    const key = username.toLowerCase();
    const existing = mergedProfiles.get(key);
    mergedProfiles.set(key, {
      discordUserId: existing?.discordUserId ?? null,
      username: existing?.username ?? username
    });
  }

  if (!mergedProfiles.size) {
    return {
      totalUsers: 0,
      rows: []
    };
  }

  const fetchedProfiles = await Promise.allSettled(
    [...mergedProfiles.values()].map(async ({ discordUserId, username }) => {
      const profile = await fetchAnimeProfile(username);

      if (!profile) {
        return null;
      }

      return {
        discordUserId,
        username: profile.username,
        aura: parseMetricValue(profile, "aura"),
        followers: parseMetricValue(profile, "followers")
      };
    })
  );

  return {
    totalUsers: mergedProfiles.size,
    rows: fetchedProfiles
      .filter((result) => result.status === "fulfilled" && result.value)
      .map((result) => result.value)
  };
}

async function fetchProfileRanks(username, guildId) {
  const leaderboardProfiles = await fetchLeaderboardProfiles(guildId);
  const targetUsername = username.toLowerCase();

  const auraRows = leaderboardProfiles.rows
    .filter((row) => row.aura != null)
    .sort((left, right) => right.aura - left.aura);
  const followersRows = leaderboardProfiles.rows
    .filter((row) => row.followers != null)
    .sort((left, right) => right.followers - left.followers);

  const auraRankIndex = auraRows.findIndex((row) => row.username.toLowerCase() === targetUsername);
  const followersRankIndex = followersRows.findIndex((row) => row.username.toLowerCase() === targetUsername);

  return {
    aura: auraRankIndex >= 0 ? auraRankIndex + 1 : null,
    followers: followersRankIndex >= 0 ? followersRankIndex + 1 : null
  };
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    const parsed = parseListInfoCustomId(interaction.customId);

    if (!parsed) {
      const leaderboardParsed = parseLeaderboardCustomId(interaction.customId);

      if (leaderboardParsed) {
        await interaction.deferUpdate();

        try {
          const leaderboard = await fetchLeaderboardRows(leaderboardParsed.metric, leaderboardParsed.guildId);

          if (!leaderboard.rows.length) {
            await interaction.editReply({
              content: `I couldn't build a ${formatMetricLabel(leaderboardParsed.metric).toLowerCase()} leaderboard from the linked and tracked accounts right now.`,
              embeds: [],
              components: []
            });
            return;
          }

          const totalPages = Math.max(1, Math.ceil(leaderboard.rows.length / leaderboardParsed.perPage));
          const safePage = Math.min(Math.max(leaderboardParsed.page, 0), totalPages - 1);

          await interaction.editReply({
            embeds: [buildLeaderboardEmbed(leaderboardParsed.metric, leaderboard.rows, leaderboard.totalUsers, safePage, leaderboardParsed.perPage)],
            components: buildLeaderboardComponents(leaderboardParsed.metric, leaderboard.rows, safePage, leaderboardParsed.perPage, leaderboardParsed.guildId)
          });
        } catch (error) {
          console.error(error);
          await interaction.editReply({
            content: "I couldn't fetch that Anime.com leaderboard right now.",
            embeds: [],
            components: []
          });
        }
        return;
      }

      const jump = parseListInfoJumpCustomId(interaction.customId);

      if (!jump) {
        const leaderboardJump = parseLeaderboardJumpCustomId(interaction.customId);

        if (!leaderboardJump) {
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId(interaction.customId)
          .setTitle("Jump to Page");

        const pageInput = new TextInputBuilder()
          .setCustomId("page")
          .setLabel("Page number")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("Enter a page number, e.g. 3");

        modal.addComponents(new ActionRowBuilder().addComponents(pageInput));
        await interaction.showModal(modal);
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(interaction.customId)
        .setTitle("Jump to Page");

      const pageInput = new TextInputBuilder()
        .setCustomId("page")
        .setLabel("Page number")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("Enter a page number, e.g. 12");

      modal.addComponents(new ActionRowBuilder().addComponents(pageInput));
      await interaction.showModal(modal);
      return;
    }

    await interaction.deferUpdate();

    try {
      const listInfo = await fetchAnimeListInfo(parsed.username, parsed.status);

      if (!listInfo) {
        await interaction.editReply({
          content: `No public Anime.com profile was found for \`${parsed.username}\`.`,
          embeds: [],
          components: []
        });
        return;
      }

      const totalPages = Math.max(1, Math.ceil(listInfo.total / parsed.perPage));
      const safePage = Math.min(Math.max(parsed.page, 0), totalPages - 1);

      await interaction.editReply({
        embeds: [buildListInfoEmbed(listInfo, safePage, parsed.perPage)],
        components: buildListInfoComponents(listInfo, safePage, parsed.perPage)
      });
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        content: "I couldn't fetch that Anime.com list right now.",
        embeds: [],
        components: []
      });
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    const jump = parseListInfoJumpCustomId(interaction.customId);

    if (!jump) {
      const leaderboardJump = parseLeaderboardJumpCustomId(interaction.customId);

      if (!leaderboardJump) {
        return;
      }

      const pageValue = interaction.fields.getTextInputValue("page");
      const requestedPage = Number.parseInt(pageValue, 10);

      if (!Number.isFinite(requestedPage) || requestedPage < 1) {
        await interaction.reply({
          content: "Please enter a valid page number greater than 0.",
          ephemeral: true
        });
        return;
      }

      await interaction.deferUpdate();

      try {
        const leaderboard = await fetchLeaderboardRows(leaderboardJump.metric, leaderboardJump.guildId);

        if (!leaderboard.rows.length) {
          await interaction.editReply({
            content: `I couldn't build a ${formatMetricLabel(leaderboardJump.metric).toLowerCase()} leaderboard from the linked and tracked accounts right now.`,
            embeds: [],
            components: []
          });
          return;
        }

        const totalPages = Math.max(1, Math.ceil(leaderboard.rows.length / leaderboardJump.perPage));
        const safePage = Math.min(Math.max(requestedPage - 1, 0), totalPages - 1);

        await interaction.editReply({
          embeds: [buildLeaderboardEmbed(leaderboardJump.metric, leaderboard.rows, leaderboard.totalUsers, safePage, leaderboardJump.perPage)],
          components: buildLeaderboardComponents(leaderboardJump.metric, leaderboard.rows, safePage, leaderboardJump.perPage, leaderboardJump.guildId)
        });
      } catch (error) {
        console.error(error);
        await interaction.editReply({
          content: "I couldn't fetch that Anime.com leaderboard right now.",
          embeds: [],
          components: []
        });
      }
      return;
    }

    const pageValue = interaction.fields.getTextInputValue("page");
    const requestedPage = Number.parseInt(pageValue, 10);

    if (!Number.isFinite(requestedPage) || requestedPage < 1) {
      await interaction.reply({
        content: "Please enter a valid page number greater than 0.",
        ephemeral: true
      });
      return;
    }

    await interaction.deferUpdate();

    try {
      const listInfo = await fetchAnimeListInfo(jump.username, jump.status);

      if (!listInfo) {
        await interaction.editReply({
          content: `No public Anime.com profile was found for \`${jump.username}\`.`,
          embeds: [],
          components: []
        });
        return;
      }

      const totalPages = Math.max(1, Math.ceil(listInfo.total / jump.perPage));
      const safePage = Math.min(Math.max(requestedPage - 1, 0), totalPages - 1);

      await interaction.editReply({
        embeds: [buildListInfoEmbed(listInfo, safePage, jump.perPage)],
        components: buildListInfoComponents(listInfo, safePage, jump.perPage)
      });
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        content: "I couldn't fetch that Anime.com list right now.",
        embeds: [],
        components: []
      });
    }
    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (!["profile", "profile-raw", "badgeinfo", "listinfo", "link", "verify", "unlink", "stats", "leaderboard", "track", "untrack"].includes(interaction.commandName)) {
    return;
  }

  await interaction.deferReply();

  try {
    if (interaction.commandName === "link") {
      const existingLinkedUsername = await getLinkedUsername(interaction.user.id);

      if (existingLinkedUsername) {
        await interaction.editReply(
          `Your Discord is already linked to Anime.com user \`@${existingLinkedUsername}\`.\nIf you want to connect a different profile, run \`/unlink\` first and then start \`/link\` again.`
        );
        return;
      }

      const username = interaction.options.getString("username", true).trim().replace(/^@/, "");
      const profile = await fetchAnimeProfile(username);

      if (!profile) {
        await interaction.editReply(`No public Anime.com profile was found for \`${username}\`.`);
        return;
      }

      const code = generateVerificationCode();
      await setPendingLink(interaction.user.id, {
        username: profile.username,
        code,
        createdAt: new Date().toISOString()
      });
        await interaction.editReply(
        {
          content: `Verification started for \`@${profile.username}\`.\n* Go to your Profile: <${profile.profileUrl}>\n* Temporarily add \`${code}\` to your Anime.com bio → save it → then run \`/verify\`.\n* After verification, you can remove the code from your bio.`,
          flags: MessageFlags.SuppressEmbeds
        }
        );
      return;
    }

    if (interaction.commandName === "verify") {
      const pending = await getPendingLink(interaction.user.id);

      if (!pending) {
        await interaction.editReply("You do not have a pending verification. Start with `/link username:<your_username>`.");
        return;
      }

      const profile = await fetchAnimeProfile(pending.username);

      if (!profile) {
        await interaction.editReply(`No public Anime.com profile was found for \`${pending.username}\`.`);
        return;
      }

      const bio = profile.bio ?? "";

      if (!bio.includes(pending.code)) {
        await interaction.editReply(
          `I could not find \`${pending.code}\` in \`@${pending.username}\`'s bio yet. Add it to your Anime.com bio, save the bio, then run \`/verify\` again.`
        );
        return;
      }

      await setLinkedUsername(interaction.user.id, profile.username);
      await removePendingLink(interaction.user.id);
      await interaction.editReply(`Verified and linked your Discord account to Anime.com user \`@${profile.username}\`. You can now use \`/stats\`.`);
      return;
    }

    if (interaction.commandName === "unlink") {
      const linkedUsername = await getLinkedUsername(interaction.user.id);

      if (interaction.guildId && linkedUsername) {
        try {
          await addTrackedUsername(interaction.guildId, linkedUsername);
        } catch {
          // Keep unlink working even if tracked-profile storage fails.
        }
      }

      if (linkedUsername) {
        await markUsernameForcedUnlinked(interaction.user.id, linkedUsername);
      }

      const removed = await removeLinkedUsername(interaction.user.id);
      await removePendingLink(interaction.user.id);
      await interaction.editReply(
        removed
          ? "Removed your linked Anime.com profile. You can link again anytime with `/link`."
          : "You do not have a linked Anime.com profile yet."
      );
      return;
    }

    if (interaction.commandName === "stats") {
      const linkedUsername = await getLinkedUsername(interaction.user.id);

      if (!linkedUsername) {
        await interaction.editReply(
          "You do not have a linked Anime.com profile yet. Use `/link username:<your_username>` first. \nor use `/profile` command instead."
        );
        return;
      }

      const profile = await fetchAnimeProfile(linkedUsername);

      if (!profile) {
        await interaction.editReply(`No public Anime.com profile was found for \`${linkedUsername}\`.`);
        return;
      }

      const ranks = await fetchProfileRanks(profile.username, interaction.guildId);
      const embed = buildProfileEmbed(profile, ranks);
      const badgeStrip = await renderBadgeStrip(profile.displayedBadges);

      if (badgeStrip) {
        embed.image = { url: "attachment://badges.png" };
        await interaction.editReply({
          embeds: [embed],
          files: [new AttachmentBuilder(badgeStrip, { name: "badges.png" })]
        });
        return;
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "track") {
      if (!interaction.inGuild() || !interaction.guildId) {
        await interaction.editReply("`/track` only works inside a server.");
        return;
      }

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.editReply("You need the `Manage Server` permission to track Anime.com profiles here.");
        return;
      }

      const username = interaction.options.getString("username", true).trim().replace(/^@/, "");
      const profile = await fetchAnimeProfile(username);

      if (!profile) {
        await interaction.editReply(`No public Anime.com profile was found for \`${username}\`.`);
        return;
      }

      const added = await addTrackedUsername(interaction.guildId, profile.username);

      await interaction.editReply(
        added
          ? `Now tracking \`@${profile.username}\` for the shared leaderboard. They will appear in \`/leaderboard\` across every server using this bot, even without linking.`
          : `\`@${profile.username}\` is already being tracked for the shared leaderboard.`
      );
      return;
    }

    if (interaction.commandName === "untrack") {
      if (!interaction.inGuild() || !interaction.guildId) {
        await interaction.editReply("`/untrack` only works inside a server.");
        return;
      }

      if (!canUseUntrack(interaction)) {
        await interaction.editReply(
          "You are not allowed to use `/untrack`. Ask a server admin, or add your Discord user ID to `UNTRACK_ALLOWED_USER_IDS`."
        );
        return;
      }

      const username = interaction.options.getString("username", true).trim().replace(/^@/, "");
      const removed = await removeTrackedUsername(interaction.guildId, username);

      await interaction.editReply(
        removed
          ? `Stopped tracking \`@${username}\` from the shared leaderboard.`
          : `\`@${username}\` is not currently tracked in the shared leaderboard.`
      );
      return;
    }

    if (interaction.commandName === "leaderboard") {
      const metric = interaction.options.getString("metric", true);
      const perPage = interaction.options.getInteger("limit") ?? 10;
      const leaderboard = await fetchLeaderboardRows(metric, interaction.guildId);

      if (!leaderboard.totalUsers) {
        await interaction.editReply(
          "There are no linked or tracked Anime.com accounts to rank yet. Use `/link` or have an admin add profiles with `/track` first."
        );
        return;
      }

      if (!leaderboard.rows.length) {
        await interaction.editReply(
          `I couldn't build a ${formatMetricLabel(metric).toLowerCase()} leaderboard from the linked and tracked accounts right now.`
        );
        return;
      }

      await interaction.editReply({
        embeds: [buildLeaderboardEmbed(metric, leaderboard.rows, leaderboard.totalUsers, 0, perPage)],
        components: buildLeaderboardComponents(metric, leaderboard.rows, 0, perPage, interaction.guildId)
      });
      return;
    }

    if (interaction.commandName === "listinfo") {
      const username = interaction.options.getString("username", true);
      const status = interaction.options.getString("status", true);
      const perPage = interaction.options.getInteger("limit") ?? 10;
      const requestedPage = interaction.options.getInteger("page") ?? 1;
      const listInfo = await fetchAnimeListInfo(username, status);

      if (!listInfo) {
        await interaction.editReply(`No public Anime.com profile was found for \`${username}\`.`);
        return;
      }

      const totalPages = Math.max(1, Math.ceil(listInfo.total / perPage));
      const safePage = Math.min(Math.max(requestedPage - 1, 0), totalPages - 1);

      await interaction.editReply({
        embeds: [buildListInfoEmbed(listInfo, safePage, perPage)],
        components: buildListInfoComponents(listInfo, safePage, perPage)
      });
      return;
    }

    const username = interaction.options.getString("username", true);
    const profile = await fetchAnimeProfile(username);

    if (!profile) {
      await interaction.editReply(`No public Anime.com profile was found for \`${username}\`.`);
      return;
    }

    if (interaction.commandName === "profile") {
      if (interaction.guildId) {
        try {
          await addTrackedUsername(interaction.guildId, profile.username);
        } catch {
          // Silent on purpose: profile lookup should still work even if tracking storage fails.
        }
      }

      const ranks = await fetchProfileRanks(profile.username, interaction.guildId);
      const embed = buildProfileEmbed(profile, ranks);
      const badgeStrip = await renderBadgeStrip(profile.displayedBadges);

      if (badgeStrip) {
        embed.image = { url: "attachment://badges.png" };
        await interaction.editReply({
          embeds: [embed],
          files: [new AttachmentBuilder(badgeStrip, { name: "badges.png" })]
        });
        return;
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "badgeinfo") {
      const badgeQuery = interaction.options.getString("badge", true);
      const embed = buildBadgeInfo(profile, badgeQuery);
      const matches = profile.earnedBadges.filter((badge) =>
        badge.name?.toLowerCase().includes(badgeQuery.trim().toLowerCase()) ||
        badge.key?.toLowerCase().includes(badgeQuery.trim().toLowerCase()) ||
        badge.description?.toLowerCase().includes(badgeQuery.trim().toLowerCase())
      );

      if (!embed) {
        await interaction.editReply(
          `No badge matching \`${badgeQuery}\` was found for \`@${profile.username}\`.`
        );
        return;
      }

      const badgeFiles = await buildBadgeAttachments(matches, "badge-match");

      await interaction.editReply(
        badgeFiles.length
          ? {
              embeds: [embed],
              files: badgeFiles
            }
          : { embeds: [embed] }
      );
      return;
    }

    const rawPayload = JSON.stringify(buildRawPayload(profile), null, 2);
    await interaction.editReply({
      content: `\`\`\`json\n${truncate(rawPayload, 1900)}\n\`\`\``
    });
  } catch (error) {
    console.error(error);
    await interaction.editReply(
      "I couldn't fetch that Anime.com profile right now. The page structure may have changed, the profile may be private, or Anime.com may be blocking requests."
    );
  }
});

client.login(token);
