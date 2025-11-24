# Redirectomator

A powerful Discord bot for tracking and managing invite links with detailed analytics. Built with the [Carbon framework](https://carbon.buape.com) and TypeScript, Redirectomator helps you understand where your Discord server members are coming from by tracking invite sources and usage statistics.

## ✨ Features

- **📊 Invite Tracking** - Create and manage invite links with primary and secondary source tracking
- **🔍 Detailed Analytics** - View usage statistics, top invites, and detailed invite information
- **📝 Source Management** - Track where members come from (Instagram, Twitter, YouTube, etc.) and where on those platforms (Bio, Post, Story, etc.)
- **📋 Logging System** - Optional logging channel for all invite actions (create, delete, user joins)
- **⚡ Fast Autocomplete** - Optimized autocomplete with caching for quick command usage
- **🎯 Smart Defaults** - Automatically uses your server's rules channel or first text channel for invites
- **🔧 Easy Management** - Edit, delete, and lookup invites with intuitive commands

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- A Discord bot token
- Discord application with bot and applications.commands scopes

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Redirectomator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_application_id_here
   DISCORD_PUBLIC_KEY=your_public_key_here
   BASE_URL=https://your-domain.com
   DEPLOY_SECRET=your_secret_for_deploy_endpoint
   PORT=3000
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Deploy commands**
   ```bash
   npm run deploy
   ```

6. **Start the bot**
   ```bash
   npm start
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_TOKEN` | Your Discord bot token | Yes |
| `CLIENT_ID` | Your Discord application ID | Yes |
| `DISCORD_PUBLIC_KEY` | Your Discord application public key | Yes |
| `BASE_URL` | Base URL for your bot (for interactions endpoint) | Yes |
| `DEPLOY_SECRET` | Secret for the deploy endpoint | Yes |
| `PORT` | Port for the HTTP server (default: 3000) | No |

### Discord Bot Permissions

Your bot needs the following permissions:
- **Manage Server** - To create and manage invites
- **View Channels** - To access channel information
- **Send Messages** - To send command responses and logs
- **Embed Links** - To send rich embeds
- **Read Message History** - For logging functionality

### Intents

The bot requires the following Discord intents:
- **Guilds** - Basic guild information
- **Guild Messages** - Message content access
- **Message Content** - To read message content
- **Guild Members** - To track member joins

## 🛠️ Development

### Project Structure

```
Redirectomator/
├── src/
│   ├── commands/       # Command files
│   ├── listeners/      # Event listeners
│   ├── utils/          # Utility functions
│   ├── database.ts     # Database operations
│   └── index.ts        # Main entry point
├── dist/               # Compiled JavaScript
├── invites.db          # SQLite database (auto-created)
└── package.json
```

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start the bot (production)
- `npm run dev` - Start the bot with watch mode (development)
- `npm run deploy` - Deploy slash commands to Discord

### Database

The bot uses SQLite (via `better-sqlite3`) to store:
- Invite links and their metadata
- Invite usage statistics
- Log channel configurations

The database file (`invites.db`) is automatically created on first run.

## 🏗️ Architecture

Redirectomator is built with:

- **[Carbon Framework](https://carbon.buape.com)** - Modern Discord bot framework
- **TypeScript** - Type-safe development
- **Gateway Plugin** - Real-time Discord events via WebSocket
- **SQLite** - Lightweight, local database
- **ESM** - Modern JavaScript modules

### How It Works

1. **Command Handling** - Carbon automatically handles slash command interactions
2. **Event Listeners** - Gateway plugin receives real-time events (member joins, invite creates/deletes)
3. **Database Tracking** - All invite data is stored locally in SQLite
4. **Caching** - Autocomplete uses intelligent caching for fast responses
5. **Logging** - Optional logging system tracks all invite-related actions

## 📊 Performance Optimizations

- **Autocomplete Caching** - Invite lists are cached for 30 seconds to reduce database queries
- **Smart Filtering** - Scoring-based filtering prioritizes relevant results
- **Efficient Queries** - Optimized database queries for fast lookups
- **Pre-loaded Sources** - Source lists are pre-loaded for instant autocomplete

## 🔒 Security

- Environment variables for sensitive data
- Secret-protected deploy endpoint
- Input validation on all commands
- SQL injection protection via parameterized queries

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Made with ❤️ using [Carbon](https://carbon.buape.com)**

