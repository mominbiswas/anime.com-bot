# Anime.com Discord Bot

A small Discord bot that fetches public Anime.com profile information for usernames such as `https://www.anime.com/u/<username>`.

## What it does

The bot currently supports:

- `/stats` for your linked Anime.com profile or another public profile
- `/rank` for aura/followers leaderboard positions
- `/compare` for side-by-side public profile comparison
- `/leaderboard` for ranked linked/tracked users
- `/listinfo` for public anime list status views
- `/profile-raw` for the raw public JSON payload

The `/stats` slash command fetches public data from Anime.com's public GraphQL endpoint and shows:

- display name
- aura
- joined date
- followers and following
- comments, lists, and reviews
- earned and featured badges
- profile bio and avatar

This project does not use an official Anime.com API. It uses Anime.com's public website GraphQL endpoint that the frontend appears to call for profile pages, so it can still break if Anime.com changes its schema, request rules, or blocks automated access.

## Requirements

- Node.js 18 or newer
- a Discord application and bot token

## Setup

1. Install Node.js 18+.
2. In this folder, run:

```bash
npm install
```

3. Copy `.env.example` to `.env` and fill in:

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_client_id_here
REGISTER_MODE=guild
DISCORD_GUILD_ID=optional_test_server_id_here
DISCORD_GUILD_IDS=optional_comma_separated_test_server_ids
DATA_DIR=optional_persistent_data_directory
ANIME_CACHE_TTL_MS=120000
```

4. Register the slash command:

```bash
npm run register
```

Registration modes:

- `REGISTER_MODE=guild`
  Use test-server registration. Commands register only to `DISCORD_GUILD_ID` / `DISCORD_GUILD_IDS` and appear quickly.
- `REGISTER_MODE=global`
  Use public/global registration. Commands register globally, support broader install contexts, and can take longer to appear.

Using only one mode at a time avoids duplicate commands.

5. Start the bot:

```bash
npm start
```

## Usage

In Discord:

```text
/stats
/stats username: anfal
/rank username: anfal
/compare user_one: anfal user_two: shomik
/listinfo username: anfal status: COMPLETED
/profile-raw username: anfal
```

## Notes

- The bot currently uses the `GetPublicUserProfile` query against `https://www.anime.com/api/graphql`.
- Anime.com responses are cached briefly in memory. You can change the TTL with `ANIME_CACHE_TTL_MS`.
- If Anime.com changes that query or starts blocking bot-like traffic, we may need to add retries, longer caching, or a browser-based fallback.
- For Railway or other hosts, set `DATA_DIR` to a persistent mounted folder if you want tracked profiles and linked accounts to survive redeploys and restarts.
