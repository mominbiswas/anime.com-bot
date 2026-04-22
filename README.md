# Anime.com Discord Bot

A small Discord bot that fetches public Anime.com profile information for usernames such as `https://www.anime.com/u/<username>`.

## What it does

The bot currently supports:

- `/profile` for a clean public profile embed
- `/profile-raw` for the raw public JSON payload
- `/badgeinfo` for finding badges by name, key, or keyword

The `/profile` slash command fetches public data from Anime.com's public GraphQL endpoint and shows:

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
DISCORD_GUILD_ID=optional_test_server_id_here
```

4. Register the slash command:

```bash
npm run register
```

If `DISCORD_GUILD_ID` is set, the command is registered to that server immediately for testing. If it is omitted, the command is registered globally and can take a bit longer to appear.

5. Start the bot:

```bash
npm start
```

## Usage

In Discord:

```text
/profile username: anfal
/profile-raw username: anfal
/badgeinfo username: anfal badge: early
```

## Notes

- The bot currently uses the `GetPublicUserProfile` query against `https://www.anime.com/api/graphql`.
- If Anime.com changes that query or starts blocking bot-like traffic, we may need to add retries, caching, or a browser-based fallback.
