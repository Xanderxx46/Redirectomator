import { Command, type CommandInteraction, type AutocompleteInteraction, ApplicationCommandOptionType, Embed } from '@buape/carbon';
import { dbOperations } from '../database.js';
import { logInviteAction } from '../utils/logger.js';
import { getCachedInvites, filterAutocomplete, PRIMARY_SOURCES, SECONDARY_SOURCES, invalidateInviteCache } from '../utils/autocompleteCache.js';

export default class EditCommand extends Command {
    name = 'edit';
    description = 'Edit an existing invite link';

    options = [
        {
            name: 'code',
            type: ApplicationCommandOptionType.String as const,
            description: 'The invite code to edit',
            required: true,
            autocomplete: true
        },
        {
            name: 'primary_source',
            type: ApplicationCommandOptionType.String as const,
            description: 'New primary source (optional)',
            required: false,
            autocomplete: true
        },
        {
            name: 'secondary_source',
            type: ApplicationCommandOptionType.String as const,
            description: 'New secondary source (optional)',
            required: false,
            autocomplete: true
        },
        {
            name: 'description',
            type: ApplicationCommandOptionType.String as const,
            description: 'New description (optional, use "none" to remove)',
            required: false
        },
        {
            name: 'max_uses',
            type: ApplicationCommandOptionType.Integer as const,
            description: 'New max uses (optional, use 0 to remove limit)',
            required: false
        }
    ]

    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused();
        if (!focusedOption) return;
        const focusedValue = String(focusedOption.value || '').toLowerCase();
        const focusedName = focusedOption.name;

        if (focusedName === 'code') {
            // Get guild ID from interaction - check if it exists as a property
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
        } else if (focusedName === 'primary_source') {
            const filtered = filterAutocomplete(
                PRIMARY_SOURCES,
                focusedValue,
                (source) => source,
                25
            );

            await interaction.respond(
                filtered.map(choice => ({ name: choice, value: choice }))
            );
        } else if (focusedName === 'secondary_source') {
            const filtered = filterAutocomplete(
                SECONDARY_SOURCES,
                focusedValue,
                (source) => source,
                25
            );

            await interaction.respond(
                filtered.map(choice => ({ name: choice, value: choice }))
            );
        }
    }

    async run(interaction: CommandInteraction) {
        const codeInput = interaction.options.getString('code') || '';
        const code = codeInput.replace(/https?:\/\/discord\.gg\//, '').replace(/https?:\/\/discord\.com\/invite\//, '');
        const primarySource = interaction.options.getString('primary_source');
        const secondarySource = interaction.options.getString('secondary_source');
        const description = interaction.options.getString('description');
        const maxUses = interaction.options.getInteger('max_uses');

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

        // Check if user has permission (must be in same guild)
        if (invite.guild_id !== guildId) {
            return interaction.reply({ 
                content: '❌ This invite belongs to a different server.'
            });
        }

        // Check if at least one field is being updated
        if (!primarySource && !secondarySource && !description && maxUses === null) {
            return interaction.reply({ 
                content: '❌ Please provide at least one field to update.'
            });
        }

        try {
            const updates: { primarySource?: string; secondarySource?: string; description?: string | null; maxUses?: number | null } = {};
            if (primarySource) updates.primarySource = primarySource;
            if (secondarySource) updates.secondarySource = secondarySource;
            if (description !== null) {
                updates.description = description === 'none' ? null : description;
            }
            if (maxUses !== null) {
                updates.maxUses = maxUses === 0 ? null : maxUses;
            }

            const updatedInvite = dbOperations.updateInvite(invite.id, updates);

            if (!updatedInvite) {
                return interaction.reply({ 
                    content: '❌ Failed to update invite. Please try again.'
                });
            }

            // Invalidate autocomplete cache
            invalidateInviteCache(guildId);

            const fields = [
                { name: 'Primary Source', value: updatedInvite.primary_source, inline: true },
                { name: 'Secondary Source', value: updatedInvite.secondary_source, inline: true },
                { name: 'Channel', value: `<#${updatedInvite.channel_id}>`, inline: true },
                { name: 'Total Uses', value: `${updatedInvite.uses}`, inline: true },
                { name: 'Max Uses', value: updatedInvite.max_uses ? `${updatedInvite.max_uses}` : 'Unlimited', inline: true }
            ];

            if (updatedInvite.description) {
                fields.push({ name: 'Description', value: updatedInvite.description, inline: false });
            }

            const embed = new Embed({
                color: 0x5865F2,
                title: '✅ Invite Updated',
                description: `Successfully updated invite \`.gg/${invite.code}\``,
                fields: fields,
                timestamp: new Date().toISOString()
            });

            await interaction.reply({ embeds: [embed] });

            // Log the edit
            if ('client' in interaction && interaction.client && 'rest' in interaction.client && typeof interaction.client.rest === 'object' && interaction.client.rest !== null && 'get' in interaction.client.rest) {
                const client = interaction.client;
                const guild = await client.rest.get(`/guilds/${guildId}`);
                
                let userId: string | null = null;
                if ('user' in interaction && interaction.user && typeof interaction.user === 'object' && 'id' in interaction.user) {
                    userId = String(interaction.user.id);
                } else if ('member' in interaction && interaction.member && typeof interaction.member === 'object') {
                    const member = interaction.member;
                    if ('user' in member && member.user && typeof member.user === 'object' && 'id' in member.user) {
                        userId = String(member.user.id);
                    }
                }

                await logInviteAction(client, guild, 'created', {
                    code: updatedInvite.code,
                    channelId: updatedInvite.channel_id,
                    primarySource: updatedInvite.primary_source,
                    secondarySource: updatedInvite.secondary_source,
                    description: updatedInvite.description || undefined,
                    createdBy: userId ? `<@${userId}> (edited)` : 'Unknown (edited)',
                });
            }
        } catch (error) {
            console.error('Error editing invite:', error);
            await interaction.reply({ 
                content: '❌ Failed to edit invite. Please try again.'
            });
        }
    }
}

