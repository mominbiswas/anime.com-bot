import "dotenv/config";
import { PermissionFlagsBits, REST, Routes, SlashCommandBuilder } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  throw new Error("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment.");
}

const commands = [
  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Fetch a public Anime.com user profile.")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Anime.com username, with or without @")
        .setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show Anime.com stats for your linked profile.")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Rank linked and tracked users by an Anime.com stat.")
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
    .toJSON(),
  new SlashCommandBuilder()
    .setName("track")
    .setDescription("Track an Anime.com username for this server's leaderboard.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Anime.com username, with or without @")
        .setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("untrack")
    .setDescription("Remove a tracked Anime.com username from this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Anime.com username, with or without @")
        .setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("link")
    .setDescription("Start verification to link your Discord account to an Anime.com profile.")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Anime.com username, with or without @")
        .setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Verify your pending Anime.com link using the code in your bio.")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("unlink")
    .setDescription("Remove your linked Anime.com profile.")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("profile-raw")
    .setDescription("Show the public Anime.com profile payload as raw JSON.")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Anime.com username, with or without @")
        .setRequired(true)
    )
    .toJSON(),
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
    .toJSON()

];

const rest = new REST({ version: "10" }).setToken(token);

try {
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  await rest.put(route, {
    body: commands
  });

  console.log(
    guildId
      ? `Successfully registered slash commands for guild ${guildId}.`
      : "Successfully registered global slash commands."
  );
} catch (error) {
  console.error("Failed to register slash commands:", error);
  process.exitCode = 1;
}
