import { Command, type CommandInteraction, type AutocompleteInteraction, ApplicationCommandOptionType, Embed } from '@buape/carbon';
import { dbOperations } from '../database.js';
import { logInviteAction } from '../utils/logger.js';
import { getCachedInvites, filterAutocomplete, invalidateInviteCache } from '../utils/autocompleteCache.js';

export default class DeleteCommand extends Command {
    name = 'delete';
    description = 'Delete a tracked invite link';

    options = [
        {
            name: 'code',
            type: ApplicationCommandOptionType.String,
            description: 'The invite code to delete (e.g., 8eqeQmTtKY)',
            required: true,
            autocomplete: true
        }
    ] as any;

    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedValue = String(interaction.options.getFocused()?.value || '');
        const guildId = (interaction as any).guild_id || (interaction as any).guild?.id;
        
        // Use cached invites for faster response
        const invites = getCachedInvites(guildId, () => dbOperations.getInvitesByGuild(guildId));

        if (invites.length === 0) {
            return interaction.respond([{
                name: 'No invites found. Create one with /create',
                value: 'no_invites',
            }]);
        }

        // Fast filtering with scoring
        const filtered = filterAutocomplete(
            invites,
            focusedValue,
            (invite) => `${invite.code} ${invite.primary_source} ${invite.secondary_source}`,
            25
        );

        const choices = filtered.map(invite => ({
            name: `${invite.primary_source} → ${invite.secondary_source} (.gg/${invite.code})`,
            value: invite.code,
        }));

        await interaction.respond(choices.length > 0 ? choices : [{
            name: 'No matching invites found',
            value: 'no_match',
        }]);
    }

    async run(interaction: CommandInteraction) {
        const codeInput = interaction.options.getString('code') || '';
        const code = codeInput.replace(/https?:\/\/discord\.gg\//, '').replace(/https?:\/\/discord\.com\/invite\//, '');

        const invite = dbOperations.getInviteByCode(code);

        if (!invite) {
            return interaction.reply({ 
                content: '❌ Invite code not found. Make sure you\'re using a code created with `/create`.'
            });
        }

        const guildId = (interaction as any).guild_id || (interaction as any).guild?.id;

        // Check if user has permission (must be in same guild and have manage server)
        if (invite.guild_id !== guildId) {
            return interaction.reply({ 
                content: '❌ This invite belongs to a different server.'
            });
        }

        try {
            // Get invite data before deletion for logging
            const inviteData = {
                code: invite.code,
                primarySource: invite.primary_source,
                secondarySource: invite.secondary_source,
                uses: invite.uses,
                deletedBy: `<@${(interaction as any).user?.id || (interaction as any).member?.user?.id}>`,
            };

            // Delete from database
            dbOperations.deleteInvite(invite.id);

            // Invalidate autocomplete cache
            invalidateInviteCache(guildId);

            // Log the deletion
            const client = (interaction as any).client;
            const guild = await client.rest.get(`/guilds/${guildId}`) as any;
            await logInviteAction(client, guild, 'deleted', inviteData);

            const embed = new Embed({
                color: 0x5865F2,
                title: '✅ Invite Deleted',
                description: `Successfully deleted invite \`.gg/${invite.code}\``,
                fields: [
                    { name: 'Primary Source', value: invite.primary_source, inline: true },
                    { name: 'Secondary Source', value: invite.secondary_source, inline: true },
                    { name: 'Total Uses', value: `${invite.uses}`, inline: true }
                ],
                timestamp: new Date().toISOString()
            });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error deleting invite:', error);
            await interaction.reply({ 
                content: '❌ Failed to delete invite. Please try again.'
            });
        }
    }
}
