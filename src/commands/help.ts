import { Command, type CommandInteraction, ApplicationCommandOptionType, Embed } from '@buape/carbon';

export default class HelpCommand extends Command {
    name = 'help';
    description = 'Shows a list of available commands';

    async run(interaction: CommandInteraction) {
        const client = (interaction as any).client;
        const commandList: string[] = [];

        // Fetch global command IDs from Discord (since commands are deployed globally)
        let globalCommands: any[] = [];
        try {
            const app = await client.rest.get('/applications/@me') as any;
            const commandsData = await client.rest.get(`/applications/${app.id}/commands`) as any[];
            globalCommands = commandsData;
        } catch (error) {
            // Fallback if we can't fetch global commands
            console.error('Error fetching global commands:', error);
        }

        for (const cmd of client.commands) {
            // Skip dev command
            if (cmd.name === 'dev') {
                continue;
            }

            // Get command ID for mention (global commands have same ID across all servers)
            const discordCommand = globalCommands.find((c: any) => c.name === cmd.name);
            const commandMention = discordCommand 
                ? `</${cmd.name}:${discordCommand.id}>`
                : `\`/${cmd.name}\``;

            let commandEntry = `${commandMention} - ${cmd.description}`;
            
            // Check for subcommands
            const subcommands = cmd.options?.filter((opt: any) => opt.type === ApplicationCommandOptionType.Subcommand) || [];
            if (subcommands.length > 0) {
                const subcommandList = subcommands.map((sub: any) => {
                    // Try to get subcommand mention
                    if (discordCommand) {
                        const subcommandOption = discordCommand.options?.find((opt: any) => opt.name === sub.name && opt.type === ApplicationCommandOptionType.Subcommand);
                        if (subcommandOption) {
                            return `  - </${cmd.name} ${sub.name}:${discordCommand.id}> - ${sub.description}`;
                        }
                    }
                    return `  - \`${sub.name}\` - ${sub.description}`;
                }).join('\n');
                commandEntry += '\n' + subcommandList;
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

