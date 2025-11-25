import { Command, type CommandInteraction, CommandWithSubcommands, Embed } from '@buape/carbon';

const OWNER_ID = '829909201262084096';

function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// Helper function to check if user is owner
function isOwner(interaction: CommandInteraction): boolean {
    let userId: string | null = null;
    if ('user' in interaction && interaction.user && typeof interaction.user === 'object' && 'id' in interaction.user) {
        userId = String(interaction.user.id);
    } else if ('member' in interaction && interaction.member && typeof interaction.member === 'object') {
        const member = interaction.member;
        if ('user' in member && member.user && typeof member.user === 'object' && 'id' in member.user) {
            userId = String(member.user.id);
        }
    }
    return userId === OWNER_ID;
}

class InfoSubcommand extends Command {
    name = 'info';
    description = 'Shows bot information';
    defer = true;

    async run(interaction: CommandInteraction) {
        // Only allow the bot owner to use this command
        if (!isOwner(interaction)) {
            return interaction.reply({ 
                content: '❌ This command is only available to the bot owner.', 
                ephemeral: true 
            });
        }

        if (!('client' in interaction) || !interaction.client) {
            return interaction.reply({ 
                content: '❌ Client not available.', 
                ephemeral: true 
            });
        }

        const client = interaction.client;
        let user: { id?: string; username?: string } | null = null;
        if ('user' in interaction && interaction.user && typeof interaction.user === 'object') {
            user = interaction.user as { id?: string; username?: string };
        } else if ('member' in interaction && interaction.member && typeof interaction.member === 'object') {
            const member = interaction.member;
            if ('user' in member && member.user && typeof member.user === 'object') {
                user = member.user as { id?: string; username?: string };
            }
        }

        let uptime = 0;
        if ('uptime' in client && typeof client.uptime === 'number') {
            uptime = client.uptime;
        }

        // Get guild count from client if available
        let guildCount = 0;
        try {
            if ('guilds' in client && client.guilds) {
                if (client.guilds instanceof Map) {
                    guildCount = client.guilds.size;
                } else if (typeof client.guilds === 'object' && 'cache' in client.guilds && client.guilds.cache instanceof Map) {
                    guildCount = client.guilds.cache.size;
                } else if (typeof client.guilds === 'object' && 'size' in client.guilds && typeof client.guilds.size === 'number') {
                    guildCount = client.guilds.size;
                }
            }
        } catch (error) {
            guildCount = 0;
        }

        const infoEmbed = new Embed({
            color: 0x5865F2,
            title: '🤖 Bot Information',
            description: 'Developer information about this bot',
            fields: [
                { name: 'Bot Name', value: user?.username || 'Unknown', inline: true },
                { name: 'Bot ID', value: user?.id || 'Unknown', inline: true },
                { name: 'Node.js Version', value: process.version, inline: true },
                { name: 'Framework', value: 'Carbon', inline: true },
                { name: 'Uptime', value: formatUptime(uptime), inline: true },
                { name: 'Guilds', value: `${guildCount}`, inline: true }
            ],
            timestamp: new Date().toISOString()
        });

        await interaction.reply({ embeds: [infoEmbed], ephemeral: true });
    }
}

class StatsSubcommand extends Command {
    name = 'stats';
    description = 'Shows bot statistics';
    defer = true;

    async run(interaction: CommandInteraction) {
        // Only allow the bot owner to use this command
        if (!isOwner(interaction)) {
            return interaction.reply({ 
                content: '❌ This command is only available to the bot owner.', 
                ephemeral: true 
            });
        }

        if (!('client' in interaction) || !interaction.client) {
            return interaction.reply({ 
                content: '❌ Client not available.', 
                ephemeral: true 
            });
        }

        const client = interaction.client;
        
        // Get stats from client if available
        let guildCount = 0;
        let userCount = 0;
        let channelCount = 0;
        let commandCount = 0;
        
        try {
            if ('guilds' in client && client.guilds) {
                let guilds: Map<unknown, unknown> | { size?: number } | null = null;
                if (client.guilds instanceof Map) {
                    guilds = client.guilds;
                    guildCount = client.guilds.size;
                } else if (typeof client.guilds === 'object' && 'cache' in client.guilds && client.guilds.cache instanceof Map) {
                    guilds = client.guilds.cache;
                    guildCount = client.guilds.cache.size;
                } else if (typeof client.guilds === 'object' && 'size' in client.guilds && typeof client.guilds.size === 'number') {
                    guildCount = client.guilds.size;
                }
                // Calculate total users
                if (guilds instanceof Map) {
                    userCount = Array.from(guilds.values()).reduce((acc: number, guild: unknown) => {
                        if (guild && typeof guild === 'object' && 'memberCount' in guild && typeof guild.memberCount === 'number') {
                            return acc + guild.memberCount;
                        }
                        return acc;
                    }, 0);
                }
            }
            if ('channels' in client && client.channels) {
                if (client.channels instanceof Map) {
                    channelCount = client.channels.size;
                } else if (typeof client.channels === 'object' && 'cache' in client.channels && client.channels.cache instanceof Map) {
                    channelCount = client.channels.cache.size;
                } else if (typeof client.channels === 'object' && 'size' in client.channels && typeof client.channels.size === 'number') {
                    channelCount = client.channels.size;
                }
            }
            // Get command count from client
            if ('commands' in client && Array.isArray(client.commands)) {
                commandCount = client.commands.length;
            }
        } catch (error) {
            // Fallback values
        }

        let ping = 0;
        if ('ws' in client && client.ws && typeof client.ws === 'object' && 'ping' in client.ws && typeof client.ws.ping === 'number') {
            ping = client.ws.ping;
        }
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

        const statsEmbed = new Embed({
            color: 0x5865F2,
            title: '📊 Bot Statistics',
            fields: [
                { name: 'Total Guilds', value: `${guildCount}`, inline: true },
                { name: 'Total Users', value: `${userCount}`, inline: true },
                { name: 'Total Channels', value: `${channelCount}`, inline: true },
                { name: 'Memory Usage', value: `${memoryUsage} MB`, inline: true },
                { name: 'Ping', value: `${ping}ms`, inline: true },
                { name: 'Commands Loaded', value: `${commandCount}`, inline: true }
            ],
            timestamp: new Date().toISOString()
        });

        await interaction.reply({ embeds: [statsEmbed], ephemeral: true });
    }
}

export default class DevCommand extends CommandWithSubcommands {
    name = 'dev';
    description = 'Developer information and bot stats';
    defer = true;
    subcommands = [new InfoSubcommand(), new StatsSubcommand()];
}
