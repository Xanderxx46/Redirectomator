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
            type: ApplicationCommandOptionType.String,
            description: 'The invite code to edit',
            required: true,
            autocomplete: true
        },
        {
            name: 'primary_source',
            type: ApplicationCommandOptionType.String,
            description: 'New primary source (optional)',
            required: false,
            autocomplete: true
        },
        {
            name: 'secondary_source',
            type: ApplicationCommandOptionType.String,
            description: 'New secondary source (optional)',
            required: false,
            autocomplete: true
        },
        {
            name: 'description',
            type: ApplicationCommandOptionType.String,
            description: 'New description (optional, use "none" to remove)',
            required: false
        },
        {
            name: 'max_uses',
            type: ApplicationCommandOptionType.Integer,
            description: 'New max uses (optional, use 0 to remove limit)',
            required: false
        }
    ] as any;

    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused();
        if (!focusedOption) return;
        const focusedValue = String(focusedOption.value || '').toLowerCase();
        const focusedName = focusedOption.name;

        if (focusedName === 'code') {
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

        const guildId = (interaction as any).guild_id || (interaction as any).guild?.id;

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
            const updates: any = {};
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

            const embedData: any = {
                color: 0x5865F2,
                title: '✅ Invite Updated',
                description: `Successfully updated invite \`.gg/${invite.code}\``,
                fields: [
                    { name: 'Primary Source', value: updatedInvite.primary_source, inline: true },
                    { name: 'Secondary Source', value: updatedInvite.secondary_source, inline: true },
                    { name: 'Channel', value: `<#${updatedInvite.channel_id}>`, inline: true },
                    { name: 'Total Uses', value: `${updatedInvite.uses}`, inline: true },
                    { name: 'Max Uses', value: updatedInvite.max_uses ? `${updatedInvite.max_uses}` : 'Unlimited', inline: true }
                ],
                timestamp: new Date().toISOString()
            };

            if (updatedInvite.description) {
                embedData.fields.push({ name: 'Description', value: updatedInvite.description, inline: false });
            }

            const embed = new Embed(embedData);

            await interaction.reply({ embeds: [embed] });

            // Log the edit
            const client = (interaction as any).client;
            const guild = await client.rest.get(`/guilds/${guildId}`) as any;
            await logInviteAction(client, guild, 'created', {
                code: updatedInvite.code,
                channelId: updatedInvite.channel_id,
                primarySource: updatedInvite.primary_source,
                secondarySource: updatedInvite.secondary_source,
                description: updatedInvite.description || undefined,
                createdBy: `<@${(interaction as any).user?.id || (interaction as any).member?.user?.id}> (edited)`,
            });
        } catch (error) {
            console.error('Error editing invite:', error);
            await interaction.reply({ 
                content: '❌ Failed to edit invite. Please try again.'
            });
        }
    }
}

