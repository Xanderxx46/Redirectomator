import { Command, type CommandInteraction, type AutocompleteInteraction, ApplicationCommandOptionType, Embed } from '@buape/carbon';
import { dbOperations } from '../database.js';
import { logInviteAction } from '../utils/logger.js';
import { PRIMARY_SOURCES, SECONDARY_SOURCES, filterAutocomplete, invalidateInviteCache } from '../utils/autocompleteCache.js';

export default class CreateCommand extends Command {
    name = 'create';
    description = 'Create a new invite link with tracking';

    options = [
        {
            name: 'primary_source',
            type: ApplicationCommandOptionType.String,
            description: 'Primary source (e.g., Instagram, Twitter, YouTube)',
            required: true,
            autocomplete: true
        },
        {
            name: 'secondary_source',
            type: ApplicationCommandOptionType.String,
            description: 'Secondary source (e.g., Bio, Post, Story)',
            required: true,
            autocomplete: true
        },
        {
            name: 'channel',
            type: ApplicationCommandOptionType.Channel,
            description: 'The channel to create the invite for',
            required: false
        },
        {
            name: 'description',
            type: ApplicationCommandOptionType.String,
            description: 'Optional description for this invite',
            required: false
        },
        {
            name: 'max_uses',
            type: ApplicationCommandOptionType.Integer,
            description: 'Maximum number of uses (optional)',
            required: false
        }
    ] as any;

    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused();
        const focusedValue = String(focusedOption?.value || '').toLowerCase();
        const focusedName = focusedOption?.name;

        if (focusedName === 'primary_source') {
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
        const channel = interaction.options.getChannel('channel');
        const primarySource = interaction.options.getString('primary_source');
        const secondarySource = interaction.options.getString('secondary_source');
        const description = interaction.options.getString('description');
        const maxUses = interaction.options.getInteger('max_uses');

        if (!primarySource || !secondarySource) {
            return interaction.reply({ 
                content: '❌ Missing required options.' 
            });
        }

        const client = (interaction as any).client;
        const guildId = (interaction as any).guild_id || (interaction as any).guild?.id;
        
        if (!guildId) {
            return interaction.reply({ 
                content: '❌ This command can only be used in a server.' 
            });
        }

        // Get channel - use provided channel or default to rules channel (or first channel)
        let targetChannel: any = null;
        let channelId: string;
        
        // Check if channel was actually provided
        // Carbon's getChannel returns null/undefined when option is not provided
        // But we also need to check if it's a valid channel object with an id
        if (channel && (typeof channel === 'string' || (channel as any).id)) {
            // Channel was provided - extract ID and fetch full channel data
            if (typeof channel === 'string') {
                channelId = channel;
            } else {
                channelId = String((channel as any).id);
            }
            
            // Only try to fetch if we have a valid channel ID
            if (channelId && channelId !== 'undefined' && channelId !== 'null') {
                try {
                    targetChannel = await client.rest.get(`/channels/${channelId}`) as any;
                } catch (error) {
                    // If we can't access the channel, fall through to default logic
                    console.error('Could not access selected channel:', error);
                    targetChannel = null;
                }
            }
        }
        
        if (!targetChannel) {
            try {
                // Get guild to check for rules channel
                const guild = await client.rest.get(`/guilds/${guildId}`) as any;
                
                // Try to use the rules channel (Discord community rules channel)
                if (guild.rules_channel_id) {
                    try {
                        targetChannel = await client.rest.get(`/channels/${guild.rules_channel_id}`) as any;
                    } catch (error) {
                        // Rules channel might not be accessible, fall through to first channel
                    }
                }

                // If no rules channel found, get the first text channel
                if (!targetChannel) {
                    const channels = await client.rest.get(`/guilds/${guildId}/channels`) as any[];
                    
                    // Find the first text channel (type 0 = text, 5 = news, 15 = forum)
                    targetChannel = channels.find((ch: any) => 
                        ch.type === 0 || ch.type === 5 || ch.type === 15
                    );

                    if (!targetChannel) {
                        return interaction.reply({ 
                            content: '❌ No text channels found in this server.' 
                        });
                    }
                }
            } catch (error) {
                console.error('Error fetching channels:', error);
                return interaction.reply({ 
                    content: '❌ Failed to get server channels. Please specify a channel.' 
                });
            }
        }

        // Check if channel is a text channel
        const channelType = targetChannel.type;
        if (channelType !== 0 && channelType !== 5 && channelType !== 15) { // Not a text channel
            return interaction.reply({ 
                content: '❌ Please select a text channel.' 
            });
        }

        channelId = targetChannel.id;

        try {

            // Create the invite (never expires)
            const invite = await client.rest.post(`/channels/${channelId}/invites`, {
                body: {
                    max_age: 0, // Never expires
                    max_uses: maxUses || 0,
                    unique: true
                }
            }) as any;

            // Get channel name
            const channelName = (targetChannel as any).name || 'Unknown';

            // Store in database
            dbOperations.createInvite({
                code: invite.code,
                guildId: guildId,
                channelId: channelId,
                channelName: channelName || 'Unknown',
                primarySource,
                secondarySource,
                description: description || null,
                maxUses: maxUses || null,
                createdBy: (interaction as any).user?.id || (interaction as any).member?.user?.id || '',
            });

            // Invalidate autocomplete cache
            invalidateInviteCache(guildId);

            // Get total invite count for this guild
            const totalInvites = dbOperations.getInviteCount(guildId);

            const embedData: any = {
                color: 0x5865F2,
                title: '✅ Invite Created!',
                fields: [
                    { name: 'Invite Link', value: `https://discord.gg/${invite.code}`, inline: false },
                    { name: 'Primary Source', value: primarySource, inline: true },
                    { name: 'Secondary Source', value: secondarySource, inline: true },
                    { name: 'Channel', value: `<#${channelId}>`, inline: true }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: `${totalInvites} total links` }
            };

            if (description) {
                embedData.description = description;
            }

            const embed = new Embed(embedData);

            await interaction.reply({ 
                embeds: [embed],
                content: `To make the most of Redirectomator, only share this link on the platform you have designated below.`
            });

            // Log the invite creation
            const guild = await client.rest.get(`/guilds/${guildId}`) as any;
            await logInviteAction(client, guild, 'created', {
                code: invite.code,
                channelId: channelId,
                primarySource,
                secondarySource,
                description,
                createdBy: `<@${(interaction as any).user?.id || (interaction as any).member?.user?.id}>`,
            });
        } catch (error) {
            console.error('Error creating invite:', error);
            await interaction.reply({ 
                content: '❌ Failed to create invite. Please try again.' 
            });
        }
    }
}
