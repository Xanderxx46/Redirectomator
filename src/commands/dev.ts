import { Command, type CommandInteraction, ApplicationCommandOptionType, Embed } from '@buape/carbon';

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

export default class DevCommand extends Command {
    name = 'dev';
    description = 'Developer information and bot stats';

    options = [
        {
            name: 'info',
            type: ApplicationCommandOptionType.Subcommand,
            description: 'Shows bot information'
        },
        {
            name: 'stats',
            type: ApplicationCommandOptionType.Subcommand,
            description: 'Shows bot statistics'
        }
    ] as any;

    async run(interaction: CommandInteraction) {
        // Only allow the bot owner to use this command
        const userId = (interaction as any).user?.id || (interaction as any).member?.user?.id;
        if (userId !== OWNER_ID) {
            return interaction.reply({ 
                content: '❌ This command is only available to the bot owner.', 
                ephemeral: true 
            });
        }

        const subcommand = (interaction.options as any).getSubcommand?.() || (interaction as any).data?.options?.[0]?.name;

        if (subcommand === 'info') {
            const client = (interaction as any).client;
            const user = (interaction as any).user || (interaction as any).member?.user;
            const uptime = (client as any).uptime || 0;

            // Get guild count from client if available
            let guildCount = 0;
            try {
                // Try to get guilds from gateway cache or make API call
                if ((client as any).guilds) {
                    guildCount = (client as any).guilds.cache?.size || (client as any).guilds.size || 0;
                } else {
                    // Fallback: might need to fetch from API
                    guildCount = 0;
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
        } else if (subcommand === 'stats') {
            const client = (interaction as any).client;
            
            // Get stats from client if available
            let guildCount = 0;
            let userCount = 0;
            let channelCount = 0;
            let commandCount = 0;
            
            try {
                if ((client as any).guilds) {
                    const guilds = (client as any).guilds.cache || (client as any).guilds;
                    guildCount = guilds.size || 0;
                    // Calculate total users
                    if (guilds instanceof Map) {
                        userCount = Array.from(guilds.values()).reduce((acc: number, guild: any) => acc + (guild.memberCount || 0), 0);
                    }
                }
                if ((client as any).channels) {
                    const channels = (client as any).channels.cache || (client as any).channels;
                    channelCount = channels.size || 0;
                }
                // Get command count from client
                commandCount = client.commands.length || 0;
            } catch (error) {
                // Fallback values
            }

            const ping = (client as any).ws?.ping || 0;
            const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

            const statsEmbed: any = {
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
            };

            await interaction.reply({ embeds: [statsEmbed], ephemeral: true });
        }
    }
}

