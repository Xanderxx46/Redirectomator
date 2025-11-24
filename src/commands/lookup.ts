import { Command, type CommandInteraction, type AutocompleteInteraction, ApplicationCommandOptionType, Embed } from '@buape/carbon';
import { dbOperations } from '../database.js';
import { getCachedInvites, filterAutocomplete } from '../utils/autocompleteCache.js';

export default class LookupCommand extends Command {
    name = 'lookup';
    description = 'Check usage statistics for an invite';

    options = [
        {
            name: 'code',
            type: ApplicationCommandOptionType.String,
            description: 'The invite code to lookup (e.g., 8eqeQmTtKY)',
            required: true,
            autocomplete: true
        }
    ] as any;

    async autocomplete(interaction: AutocompleteInteraction) {
        const focused = interaction.options.getFocused();
        const focusedValue = String(focused?.value || '');
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
            name: `${invite.primary_source} → ${invite.secondary_source} (.gg/${invite.code}) - ${invite.uses} uses`,
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

        // Get stats
        const stats = dbOperations.getInviteStats(invite.id);
        const recentUses = dbOperations.getRecentUses(invite.id, 10);

        const embedData: any = {
            color: 0x5865F2,
            title: '🔍 Invite Lookup',
            fields: [
                { name: 'Invite Code', value: `\`.gg/${invite.code}\``, inline: true },
                { name: 'Total Uses', value: `${invite.uses}`, inline: true },
                { name: 'Max Uses', value: invite.max_uses ? `${invite.max_uses}` : 'Unlimited', inline: true },
                { name: 'Primary Source', value: invite.primary_source, inline: true },
                { name: 'Secondary Source', value: invite.secondary_source, inline: true },
                { name: 'Channel', value: `<#${invite.channel_id}>`, inline: true }
            ],
            timestamp: new Date().toISOString()
        };

        if (invite.description) {
            embedData.description = invite.description;
        }

        if (recentUses.length > 0) {
            const recentList = recentUses.map((use: any) => {
                const date = new Date(use.used_at);
                return `• <@${use.user_id}> (${use.username}) - <t:${Math.floor(date.getTime() / 1000)}:R>`;
            }).join('\n');
            embedData.fields.push({ 
                name: 'Recent Uses', 
                value: recentList.length > 1024 ? recentList.substring(0, 1021) + '...' : recentList || 'None',
                inline: false 
            });
        }

        const embed = new Embed(embedData);

        await interaction.reply({ embeds: [embed] });
    }
}

