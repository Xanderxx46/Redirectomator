import { Command, type CommandInteraction, Embed } from '@buape/carbon';
import { dbOperations } from '../database.js';

export default class LinksCommand extends Command {
    name = 'links';
    description = 'View all invite links for this server';

    async run(interaction: CommandInteraction) {
        const guildId = (interaction as any).guild_id || (interaction as any).guild?.id;
        const invites = dbOperations.getInvitesByGuild(guildId);

        if (invites.length === 0) {
            // Get guild name
            let guildName = 'this server';
            try {
                const client = (interaction as any).client;
                const guild = await client.rest.get(`/guilds/${guildId}`) as any;
                guildName = guild.name || guildName;
            } catch (error) {
                // Use default
            }

            const embed = new Embed({
                color: 0x5865F2,
                title: `📋 Invites for ${guildName}`,
                description: 'No invites have been created yet. Use `/create` to create your first invite!',
                timestamp: new Date().toISOString()
            });

            return interaction.reply({ embeds: [embed] });
        }

        // Build the list of invites
        const inviteList = invites.map(invite => {
            const description = invite.description 
                ? `${invite.primary_source} → ${invite.secondary_source} (${invite.description})`
                : `${invite.primary_source} → ${invite.secondary_source}`;
            return `**${description}**\n\`.gg/${invite.code}\` - <#${invite.channel_id}> (${invite.uses} uses)`;
        }).join('\n\n');

        const totalInvites = invites.length;

        // Get guild name
        let guildName = 'this server';
        try {
            const client = (interaction as any).client;
            const guild = await client.rest.get(`/guilds/${guildId}`) as any;
            guildName = guild.name || guildName;
        } catch (error) {
            // Use default
        }

        const embed = new Embed({
            color: 0x5865F2,
            title: `📋 Invites for ${guildName}`,
            description: `You are using a total of ${totalInvites} links\n\n${inviteList}`,
            timestamp: new Date().toISOString(),
            footer: { text: 'Use the /lookup command to check invite uses.' }
        });

        await interaction.reply({ embeds: [embed] });
    }
}

