import "dotenv/config";
import {
  ApplicationIntegrationType,
  InteractionContextType,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const guildIds = [
  ...new Set(
    [
      ...(process.env.DISCORD_GUILD_IDS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      ...(guildId ? [guildId] : [])
    ]
  )
];

if (!token || !clientId) {
  throw new Error("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment.");
}

const isGlobalRegistration = guildIds.length === 0;

function applyGlobalAvailability(command) {
  if (!isGlobalRegistration) {
    return command;
  }

  return command
    .setIntegrationTypes(
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    )
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    );
}

const commands = [
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("stats")
      .setDescription("Show your linked Anime.com profile, or fetch another user's public profile.")
      .addUserOption((option) =>
        option
          .setName("member")
          .setDescription("Pick a Discord user who already linked their Anime.com account")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("username")
          .setDescription("Anime.com username, with or without @")
          .setRequired(false)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("Rank linked and tracked Anime.com users by a stat.")
      .addStringOption((option) =>
        option
          .setName("metric")
          .setDescription("Which stat to rank by")
          .setRequired(true)
          .addChoices(
            { name: "Aura", value: "aura" },
            { name: "Followers", value: "followers" }
          )
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many users to show")
          .setMinValue(1)
          .setMaxValue(20)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("topbadges")
      .setDescription("Rank linked and tracked Anime.com users by badge count.")
      .addStringOption((option) =>
        option
          .setName("type")
          .setDescription("Which badge count to rank by")
          .setRequired(true)
          .addChoices(
            { name: "Displayed badges", value: "displayed" },
            { name: "All earned badges", value: "earned" }
          )
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many users to show")
          .setMinValue(1)
          .setMaxValue(20)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("toplists")
      .setDescription("Rank linked and tracked Anime.com users by list stats.")
      .addStringOption((option) =>
        option
          .setName("metric")
          .setDescription("Which list stat to rank by")
          .setRequired(true)
          .addChoices(
            { name: "Completed", value: "completed" },
            { name: "Watching", value: "watching" },
            { name: "Planning", value: "planning" },
            { name: "Dropped", value: "dropped" },
            { name: "Avg rating", value: "avgRating" }
          )
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many users to show")
          .setMinValue(1)
          .setMaxValue(20)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("topsocial")
      .setDescription("Rank linked and tracked Anime.com users by social stats.")
      .addStringOption((option) =>
        option
          .setName("metric")
          .setDescription("Which social stat to rank by")
          .setRequired(true)
          .addChoices(
            { name: "Comments", value: "comments" },
            { name: "Reviews", value: "reviews" },
            { name: "Lists", value: "lists" }
          )
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many users to show")
          .setMinValue(1)
          .setMaxValue(20)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("topgrowth")
      .setDescription("Rank linked and tracked Anime.com users by 7-day growth.")
      .addStringOption((option) =>
        option
          .setName("metric")
          .setDescription("Which 7-day growth stat to rank by")
          .setRequired(true)
          .addChoices(
            { name: "Aura gain (7d)", value: "aura7d" },
            { name: "Followers gain (7d)", value: "followers7d" }
          )
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many users to show")
          .setMinValue(1)
          .setMaxValue(20)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("topreviews")
      .setDescription("Show top reviewers or avg rating leaders with a minimum list threshold.")
      .addStringOption((option) =>
        option
          .setName("metric")
          .setDescription("Which review-focused stat to rank by")
          .setRequired(true)
          .addChoices(
            { name: "Top reviewers", value: "reviews" },
            { name: "Avg rating leaders", value: "avgRating" }
          )
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many users to show")
          .setMinValue(1)
          .setMaxValue(20)
      )
      .addIntegerOption((option) =>
        option
          .setName("min_lists")
          .setDescription("Minimum list count for avg rating leaders")
          .setMinValue(1)
          .setMaxValue(500)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("milestones")
      .setDescription("Show users closest to their next aura and follower milestones.")
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many users to show in each milestone list")
          .setMinValue(1)
          .setMaxValue(15)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("discoverusers")
      .setDescription("Discover public Anime.com usernames from a show's visible public page.")
      .addStringOption((option) =>
        option
          .setName("show")
          .setDescription("Anime.com show slug, for example naruto")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("source")
          .setDescription("Which public area to scan")
          .setRequired(true)
          .addChoices(
            { name: "All public usernames", value: "all" },
            { name: "Reviews section", value: "reviews" },
            { name: "Discussions section", value: "discussions" }
          )
      )
      .addBooleanOption((option) =>
        option
          .setName("save")
          .setDescription("Save discovered usernames into tracked users (admins only)")
          .setRequired(false)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("compare")
      .setDescription("Compare two public Anime.com profiles side by side.")
      .addStringOption((option) =>
        option
          .setName("user_one")
          .setDescription("First Anime.com username, with or without @")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("user_two")
          .setDescription("Second Anime.com username, with or without @")
          .setRequired(true)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("rank")
      .setDescription("Show a user's Anime.com leaderboard ranks.")
      .addUserOption((option) =>
        option
          .setName("member")
          .setDescription("Pick a Discord user who already linked their Anime.com account")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("username")
          .setDescription("Anime.com username, with or without @")
          .setRequired(false)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("history")
      .setDescription("Show how a user's Anime.com aura and followers changed over time.")
      .addUserOption((option) =>
        option
          .setName("member")
          .setDescription("Pick a Discord user who already linked their Anime.com account")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("username")
          .setDescription("Anime.com username, with or without @")
          .setRequired(false)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("serverstats")
      .setDescription("Show a server summary of linked, tracked, and top-ranked Anime.com users.")
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("activityfeed")
      .setDescription("Configure automatic Anime.com activity posts for this server.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("The channel where the bot should post feed updates")
          .setRequired(true)
      )
      .addBooleanOption((option) =>
        option
          .setName("reviews")
          .setDescription("Post trending public reviews")
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName("discussions")
          .setDescription("Post trending public general discussions")
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName("episode_discussions")
          .setDescription("Post trending episode discussion threads")
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName("memes")
          .setDescription("Post trending public memes")
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName("polls")
          .setDescription("Post trending public polls")
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName("news")
          .setDescription("Post Anime.com news items")
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName("linked_users")
          .setDescription("Post new review/discussion posts from linked users")
          .setRequired(false)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("activityfeed-status")
      .setDescription("Show the current Anime.com activity feed settings for this server.")
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("activityfeed-settings")
      .setDescription("View or update per-type Anime.com activity feed filters for this server.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((subcommand) =>
        subcommand
          .setName("view")
          .setDescription("Show the current per-type feed filters")
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("set")
          .setDescription("Update the filter values for one feed type")
          .addStringOption((option) =>
            option
              .setName("type")
              .setDescription("Which feed type to update")
              .setRequired(true)
              .addChoices(
                { name: "Reviews", value: "reviews" },
                { name: "Discussions", value: "discussions" },
                { name: "Ep Discussions", value: "episodeDiscussions" },
                { name: "Memes", value: "memes" },
                { name: "Polls", value: "polls" },
                { name: "News", value: "news" }
              )
          )
          .addIntegerOption((option) =>
            option
              .setName("max_age_days")
              .setDescription("Skip items older than this many days")
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(30)
          )
          .addIntegerOption((option) =>
            option
              .setName("min_reactions")
              .setDescription("Require at least this many reactions")
              .setRequired(false)
              .setMinValue(0)
              .setMaxValue(10000)
          )
          .addIntegerOption((option) =>
            option
              .setName("max_posts_per_run")
              .setDescription("Allow up to this many posts from this type per feed run")
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(10)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("reset")
          .setDescription("Reset one feed type back to the default filter values")
          .addStringOption((option) =>
            option
              .setName("type")
              .setDescription("Which feed type to reset")
              .setRequired(true)
              .addChoices(
                { name: "Reviews", value: "reviews" },
                { name: "Discussions", value: "discussions" },
                { name: "Ep Discussions", value: "episodeDiscussions" },
                { name: "Memes", value: "memes" },
                { name: "Polls", value: "polls" },
                { name: "News", value: "news" }
              )
          )
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("activityfeed-disable")
      .setDescription("Disable automatic Anime.com activity posts for this server.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("activityfeed-run")
      .setDescription("Run the Anime.com activity feed once right now for this server.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("track")
      .setDescription("Track an Anime.com username for the bot's shared leaderboard.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addStringOption((option) =>
        option
          .setName("username")
          .setDescription("Anime.com username, with or without @")
          .setRequired(true)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("untrack")
      .setDescription("Remove a tracked Anime.com username from the shared leaderboard.")
      .addStringOption((option) =>
        option
          .setName("username")
          .setDescription("Anime.com username, with or without @")
          .setRequired(true)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("link")
      .setDescription("Start verification to link your Discord account to an Anime.com profile.")
      .addStringOption((option) =>
        option
          .setName("username")
          .setDescription("Anime.com username, with or without @")
          .setRequired(true)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("verify")
      .setDescription("Verify your pending Anime.com link using the code in your bio.")
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("unlink")
      .setDescription("Remove your linked Anime.com profile.")
  ).toJSON(),

  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("profile-raw")
      .setDescription("Show the public Anime.com profile payload as raw JSON.")
      .addStringOption((option) =>
        option
          .setName("username")
          .setDescription("Anime.com username, with or without @")
          .setRequired(true)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("liststats")
      .setDescription("Show compact Anime.com list counts for one user.")
      .addUserOption((option) =>
        option
          .setName("member")
          .setDescription("Pick a Discord user who already linked their Anime.com account")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("username")
          .setDescription("Anime.com username, with or without @")
          .setRequired(false)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("recent")
      .setDescription("Show a user's most recently updated Anime.com entries.")
      .addUserOption((option) =>
        option
          .setName("member")
          .setDescription("Pick a Discord user who already linked their Anime.com account")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("username")
          .setDescription("Anime.com username, with or without @")
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many recent entries to show")
          .setMinValue(1)
          .setMaxValue(15)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("badges")
      .setDescription("Show displayed or earned Anime.com badges for one user.")
      .addStringOption((option) =>
        option
          .setName("type")
          .setDescription("Which badges to show")
          .setRequired(true)
          .addChoices(
            { name: "Displayed badges", value: "displayed" },
            { name: "All earned badges", value: "earned" }
          )
      )
      .addUserOption((option) =>
        option
          .setName("member")
          .setDescription("Pick a Discord user who already linked their Anime.com account")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("username")
          .setDescription("Anime.com username, with or without @")
          .setRequired(false)
      )
  ).toJSON(),
  applyGlobalAvailability(
    new SlashCommandBuilder()
      .setName("listinfo")
      .setDescription("Show a public Anime.com user's list for a specific status.")
      .addStringOption((option) =>
        option
          .setName("username")
          .setDescription("Anime.com username, with or without @")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("status")
          .setDescription("Which list status to show")
          .setRequired(true)
          .addChoices(
            { name: "Completed", value: "COMPLETED" },
            { name: "Planning", value: "PLANNING" },
            { name: "Watching", value: "WATCHING" },
            { name: "Dropped", value: "DROPPED" }
          )
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many anime to show per page")
          .setMinValue(1)
          .setMaxValue(25)
      )
      .addIntegerOption((option) =>
        option
          .setName("page")
          .setDescription("Which page to jump to")
          .setMinValue(1)
      )
  ).toJSON()

];

const rest = new REST({ version: "10" }).setToken(token);

try {
  if (guildIds.length) {
    for (const currentGuildId of guildIds) {
      const route = Routes.applicationGuildCommands(clientId, currentGuildId);

      await rest.put(route, {
        body: commands
      });

      console.log(`Successfully registered slash commands for guild ${currentGuildId}.`);
    }
  } else {
    const route = Routes.applicationCommands(clientId);

    await rest.put(route, {
      body: commands
    });

    console.log("Successfully registered global slash commands.");
  }
} catch (error) {
  console.error("Failed to register slash commands:", error);
  process.exitCode = 1;
}
