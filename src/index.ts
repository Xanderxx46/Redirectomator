import { config } from 'dotenv';
import { Client, type BaseCommand } from '@buape/carbon';
// @ts-ignore
import { GatewayPlugin, GatewayIntents } from '@buape/carbon/gateway';
import { createServer } from '@buape/carbon/adapters/node';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Ready } from './listeners/ready.js';
import { GuildMemberAdd } from './listeners/guildMemberAdd.js';
import { InviteCreate } from './listeners/inviteCreate.js';
import { InviteDelete } from './listeners/inviteDelete.js';

// Load environment variables
config();

// Validate required environment variables
const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'DISCORD_PUBLIC_KEY', 'BASE_URL', 'DEPLOY_SECRET'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`❌ ${envVar} is not set in .env file!`);
        process.exit(1);
    }
}

// Load commands before creating the client
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commands: BaseCommand[] = [];
for (const file of commandFiles) {
    try {
        const commandModule = await import(`./commands/${file}`);
        if (commandModule.default) {
            // Instantiate the command class
            const commandInstance = new commandModule.default();
            if (commandInstance.name) {
                commands.push(commandInstance);
                console.log(`✅ Loaded command: ${commandInstance.name}`);
            }
        }
    } catch (error) {
        console.error(`Error loading command ${file}:`, error);
    }
}

// Initialize Carbon client with Gateway plugin
const client = new Client(
    {
        baseUrl: process.env.BASE_URL!,
        deploySecret: process.env.DEPLOY_SECRET!,
        clientId: process.env.CLIENT_ID!,
        publicKey: process.env.DISCORD_PUBLIC_KEY!,
        token: process.env.DISCORD_TOKEN!
    },
    {
        commands: commands,
        listeners: [
            new Ready(),
            new GuildMemberAdd(),
            new InviteCreate(),
            new InviteDelete()
        ]
    },
    [
        new GatewayPlugin({
            intents: GatewayIntents.Guilds |
                    GatewayIntents.GuildMessages |
                    GatewayIntents.MessageContent |
                    GatewayIntents.GuildMembers
        })
    ]
);

// Create and start the HTTP server for interactions
const port = parseInt(process.env.PORT || '3000', 10);
createServer(client, { port });

console.log(`🚀 Server started on port ${port}`);
console.log(`📡 Interactions endpoint: ${process.env.BASE_URL}/interactions`);
console.log(`🔧 Deploy commands: ${process.env.BASE_URL}/deploy?secret=${process.env.DEPLOY_SECRET}`);

