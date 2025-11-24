import { Command, type CommandInteraction, ApplicationCommandOptionType, Embed } from '@buape/carbon';
import { dbOperations } from '../database.js';

export default class TopCommand extends Command {
    name = 'top';
    description = 'View top invite links by usage';

    options = [
        {
            name: 'limit',
            type: ApplicationCommandOptionType.Integer,
            description: 'Number of invites to show (default: 10, max: 25)',
            required: false,
            min_value: 1,
            max_value: 25
        }
    ] as any;

    async run(interaction: CommandInteraction) {
        const limit = interaction.options.getInteger('limit') || 10;
        const guildId = (interaction as any).guild_id || (interaction as any).guild?.id;
        const topInvites = dbOperations.getTopInvites(guildId, limit);

        // Get guild name
        let guildName = 'this server';
        try {
            const client = (interaction as any).client;
            const guild = await client.rest.get(`/guilds/${guildId}`) as any;
            guildName = guild.name || guildName;
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

