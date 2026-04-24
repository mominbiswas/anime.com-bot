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
