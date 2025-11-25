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
            type: ApplicationCommandOptionType.String as const,
            description: 'The invite code to delete (e.g., 8eqeQmTtKY)',
            required: true,
            autocomplete: true
        }
    ] 
    
    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused();
        const focusedValue = String(focusedOption?.value || '');
        
        let guildId: string | null = null;
        if ('guild_id' in interaction && typeof interaction.guild_id === 'string') {
            guildId = interaction.guild_id;
        } else if ('guild' in interaction && interaction.guild && typeof interaction.guild === 'object' && 'id' in interaction.guild) {
            guildId = String(interaction.guild.id);
        }
        
        if (!guildId) {
            return interaction.respond([{
                name: 'This command can only be used in a server',
                value: 'no_guild'
            }]);
        }
        
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

        // Check if user has permission (must be in same guild and have manage server)
        if (invite.guild_id !== guildId) {
            return interaction.reply({ 
                content: '❌ This invite belongs to a different server.'
            });
        }

        try {
            let userId: string | null = null;
            if ('user' in interaction && interaction.user && typeof interaction.user === 'object' && 'id' in interaction.user) {
                userId = String(interaction.user.id);
            } else if ('member' in interaction && interaction.member && typeof interaction.member === 'object') {
                const member = interaction.member;
                if ('user' in member && member.user && typeof member.user === 'object' && 'id' in member.user) {
                    userId = String(member.user.id);
                }
            }

            // Get invite data before deletion for logging
            const inviteData = {
                code: invite.code,
                primarySource: invite.primary_source,
                secondarySource: invite.secondary_source,
                uses: invite.uses,
                deletedBy: userId ? `<@${userId}>` : 'Unknown',
            };

            // Delete from database
            dbOperations.deleteInvite(invite.id);

            // Invalidate autocomplete cache
            invalidateInviteCache(guildId);

            // Log the deletion
            if ('client' in interaction && interaction.client && 'rest' in interaction.client && typeof interaction.client.rest === 'object' && interaction.client.rest !== null && 'get' in interaction.client.rest) {
                const client = interaction.client;
                const guild = await client.rest.get(`/guilds/${guildId}`);
                await logInviteAction(client, guild, 'deleted', inviteData);
            }

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
