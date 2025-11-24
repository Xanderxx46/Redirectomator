## Prerequisites

- Node.js 18.0.0 or higher
- A Discord bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- npm or yarn

## Setup

1. **Clone or download this template**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure your bot:**
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and add your bot credentials:
     ```
     DISCORD_TOKEN=your_bot_token_here
     CLIENT_ID=your_client_id_here
     GUILD_ID=your_guild_id_here
     ```

4. **Get your Discord bot credentials:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application or select an existing one
   - Go to the "Bot" section and create a bot
   - Copy the bot token to `DISCORD_TOKEN`
   - Go to "General Information" and copy the Application ID to `CLIENT_ID`
   - (Optional) Copy your server/guild ID to `GUILD_ID` for faster command deployment during development

5. **Invite your bot to your server:**
   - Go to "OAuth2" > "URL Generator"
   - Select scopes: `bot` and `applications.commands`
   - Select bot permissions as needed
   - Copy and visit the generated URL to invite the bot

6. **Deploy slash commands:**
   ```bash
   node src/deploy-commands.js
   ```
   - If `GUILD_ID` is set, commands deploy to that guild (instant)
   - If `GUILD_ID` is not set, commands deploy globally (may take up to 1 hour)

7. **Start the bot:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

## Project Structure

```
.
├── src/
│   ├── commands/          # Command files
│   │   ├── ping.js        # Sample ping command
│   │   ├── dev.js         # Developer command with info/stats
│   │   └── help.js        # Help command
│   ├── index.js           # Main bot file
│   └── deploy-commands.js # Command deployment script
├── .env.example           # Environment variables template
├── .gitignore            # Git ignore file
├── package.json          # Project dependencies
└── README.md            # This file
```

## Creating New Commands

1. Create a new file in `src/commands/` (e.g., `mycommand.js`)
2. Export a default object with `data` and `execute` properties:

```javascript
import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('mycommand')
        .setDescription('My command description'),
    async execute(interaction) {
        await interaction.reply('Hello!');
    },
};
```

3. Restart the bot (or use `npm run dev` for auto-reload)
4. Redeploy commands: `node src/deploy-commands.js`

## Troubleshooting

- **Bot doesn't respond to commands:** Make sure you've deployed commands using `node src/deploy-commands.js`
- **"Missing Permissions" error:** Check that the bot has the necessary permissions in your server
- **Commands not showing up:** Wait a few minutes after deployment, or restart Discord

## License

MIT

