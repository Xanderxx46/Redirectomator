import { Command, type CommandInteraction, ApplicationCommandOptionType, Embed } from '@buape/carbon';
import { dbOperations } from '../database.js';

export default class TopCommand extends Command {
    name = 'top';
    description = 'View top invite links by usage';

    options = [
        {
            name: 'limit',
            type: ApplicationCommandOptionType.Integer as const,
            description: 'Number of invites to show (default: 10, max: 25)',
            required: false,
            min_value: 1,
            max_value: 25
        }
    ]

    async run(interaction: CommandInteraction) {
        const limit = interaction.options.getInteger('limit') || 10;
        let guildId: string | null = null;
        if ('guild_id' in interaction && typeof interaction.guild_id === 'string') {
            guildId = interaction.guild_id;
        } else if ('guild' in interaction && interaction.guild && typeof interaction.guild === 'object' && 'id' in interaction.guild) {
            guildId = String(interaction.guild.id);
        }

        if (!guildId) {
            return interaction.reply({ 
                content: '❌ This command can only be used in a server.' 
            });
        }

        const topInvites = dbOperations.getTopInvites(guildId, limit);

        // Get guild name
        let guildName = 'this server';
        try {
            if ('client' in interaction && interaction.client && 'rest' in interaction.client && typeof interaction.client.rest === 'object' && interaction.client.rest !== null && 'get' in interaction.client.rest) {
                const client = interaction.client;
                const guild = await client.rest.get(`/guilds/${guildId}`);
                if (guild && typeof guild === 'object' && 'name' in guild && typeof guild.name === 'string') {
                    guildName = guild.name;
                }
            }
        } catch (error) {
            // Use default
        }

        if (topInvites.length === 0) {
            const embed = new Embed({
                color: 0x5865F2,
                title: `🏆 Top Invites for ${guildName}`,
                description: 'No invites have been created yet. Use `/create` to create your first invite!',
                timestamp: new Date().toISOString()
            });

            return interaction.reply({ embeds: [embed] });
        }

        // Build the list of top invites
        const inviteList = topInvites.map((invite, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            const description = invite.description 
                ? `${invite.primary_source} → ${invite.secondary_source} (${invite.description})`
                : `${invite.primary_source} → ${invite.secondary_source}`;
            return `${medal} **${description}**\n\`.gg/${invite.code}\` - <#${invite.channel_id}> - **${invite.uses}** uses`;
        }).join('\n\n');

        const embed = new Embed({
            color: 0x5865F2,
            title: `🏆 Top Invites for ${guildName}`,
            description: inviteList,
            timestamp: new Date().toISOString(),
            footer: { text: `Showing top ${topInvites.length} invites by usage` }
        });

        await interaction.reply({ embeds: [embed] });
    }
}

