import { Command, type CommandInteraction, ApplicationCommandOptionType, Embed } from '@buape/carbon';

export default class HelpCommand extends Command {
    name = 'help';
    description = 'Shows a list of available commands';

    async run(interaction: CommandInteraction) {
        if (!('client' in interaction) || !interaction.client || !('rest' in interaction.client) || typeof interaction.client.rest !== 'object' || !interaction.client.rest || !('get' in interaction.client.rest) || !('commands' in interaction.client) || !Array.isArray(interaction.client.commands)) {
            return interaction.reply({ 
                content: '❌ Client not available.' 
            });
        }

        const client = interaction.client;
        const commandList: string[] = [];

        // Fetch global command IDs from Discord (since commands are deployed globally)
        interface DiscordCommand {
            id: string;
            name: string;
            options?: Array<{ name: string; type: number }>;
        }

        let globalCommands: DiscordCommand[] = [];
        try {
            const app = await client.rest.get('/applications/@me');
            if (app && typeof app === 'object' && 'id' in app) {
                const commandsData = await client.rest.get(`/applications/${String(app.id)}/commands`);
                if (Array.isArray(commandsData)) {
                    globalCommands = commandsData.filter((c): c is DiscordCommand => 
                        c && typeof c === 'object' && 'id' in c && 'name' in c
                    ) as DiscordCommand[];
                }
            }
        } catch (error) {
            // Fallback if we can't fetch global commands
            console.error('Error fetching global commands:', error);
        }

        for (const cmd of client.commands) {
            // Skip dev command
            if ('name' in cmd && cmd.name === 'dev') {
                continue;
            }

            // Get command ID for mention (global commands have same ID across all servers)
            const discordCommand = globalCommands.find((c) => c.name === cmd.name);
            const commandMention = discordCommand 
                ? `</${cmd.name}:${discordCommand.id}>`
                : `\`/${cmd.name}\``;

            let commandEntry = `${commandMention} - ${'description' in cmd ? cmd.description : 'No description'}`;
            
            // Check for subcommands
            if ('options' in cmd && Array.isArray(cmd.options)) {
                const subcommands = cmd.options.filter((opt) => 
                    opt && typeof opt === 'object' && 'type' in opt && opt.type === ApplicationCommandOptionType.Subcommand
                );
                if (subcommands.length > 0) {
                    const subcommandList = subcommands.map((sub) => {
                        const subName = 'name' in sub ? sub.name : 'unknown';
                        const subDesc = 'description' in sub ? sub.description : 'No description';
                        // Try to get subcommand mention
                        if (discordCommand && discordCommand.options) {
                            const subcommandOption = discordCommand.options.find((opt) => opt.name === subName && opt.type === ApplicationCommandOptionType.Subcommand);
                            if (subcommandOption) {
                                return `  - </${cmd.name} ${subName}:${discordCommand.id}> - ${subDesc}`;
                            }
                        }
                        return `  - \`${subName}\` - ${subDesc}`;
                    }).join('\n');
                    commandEntry += '\n' + subcommandList;
                }
            }
            
            commandList.push(commandEntry);
        }

        const helpEmbed = new Embed({
            color: 0x5865F2,
            title: 'Available Commands',
            description: commandList.join('\n\n') || 'No commands available.',
            timestamp: new Date().toISOString()
        });

        await interaction.reply({ embeds: [helpEmbed] });
    }
}

