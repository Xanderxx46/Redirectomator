import { Command, type CommandInteraction, Embed } from '@buape/carbon';
import { dbOperations } from '../database.js';

export default class LinksCommand extends Command {
    name = 'links';
    description = 'View all invite links for this server';

    async run(interaction: CommandInteraction) {
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

        const invites = dbOperations.getInvitesByGuild(guildId);

        const getGuildName = async (): Promise<string> => {
            try {
                if ('client' in interaction && interaction.client && 'rest' in interaction.client && typeof interaction.client.rest === 'object' && interaction.client.rest !== null && 'get' in interaction.client.rest) {
                    const client = interaction.client;
                    const guild = await client.rest.get(`/guilds/${guildId}`);
                    if (guild && typeof guild === 'object' && 'name' in guild && typeof guild.name === 'string') {
                        return guild.name;
                    }
                }
            } catch (error) {
                // Use default
            }
            return 'this server';
        };

        if (invites.length === 0) {
            // Get guild name
            const guildName = await getGuildName();

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
        const guildName = await getGuildName();

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

