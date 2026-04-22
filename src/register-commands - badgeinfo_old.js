import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

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
    .setName("badgeinfo")
    .setDescription("Find matching badges on a public Anime.com profile.")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Anime.com username, with or without @")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("badge")
        .setDescription("Badge name, key, or keyword to search for")
        .setRequired(true)
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
