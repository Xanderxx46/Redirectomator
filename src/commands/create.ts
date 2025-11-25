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
            type: ApplicationCommandOptionType.String as const,
            description: 'Primary source (e.g., Instagram, Twitter, YouTube)',
            required: true,
            autocomplete: true
        },
        {
            name: 'secondary_source',
            type: ApplicationCommandOptionType.String as const,
            description: 'Secondary source (e.g., Bio, Post, Story)',
            required: true,
            autocomplete: true
        },
        {
            name: 'channel',
            type: ApplicationCommandOptionType.Channel as const,
            description: 'The channel to create the invite for',
            required: false
        },
        {
            name: 'description',
            type: ApplicationCommandOptionType.String as const,
            description: 'Optional description for this invite',
            required: false
        },
        {
            name: 'max_uses',
            type: ApplicationCommandOptionType.Integer as const,
            description: 'Maximum number of uses (optional)',
            required: false
        }
    ]
    
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

        if (!('client' in interaction) || !interaction.client || !('rest' in interaction.client) || typeof interaction.client.rest !== 'object' || !interaction.client.rest || !('get' in interaction.client.rest) || !('post' in interaction.client.rest)) {
            return interaction.reply({ 
                content: '❌ Client not available.' 
            });
        }

        const client = interaction.client;
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

        // Get channel - use provided channel or default to rules channel (or first channel)
        interface ChannelData {
            id: string;
            name?: string;
            type: number;
        }

        let targetChannel: ChannelData | null = null;
        let channelId: string;
        
        // Check if channel was actually provided
        if (channel) {
            if (typeof channel === 'string') {
                channelId = channel;
            } else if (typeof channel === 'object' && channel !== null && 'id' in channel) {
                channelId = String(channel.id);
            } else {
                channelId = '';
            }
            
            if (channelId && channelId !== 'undefined' && channelId !== 'null') {
                try {
                    const fetchedChannel = await client.rest.get(`/channels/${channelId}`);
                    if (fetchedChannel && typeof fetchedChannel === 'object' && 'id' in fetchedChannel && 'type' in fetchedChannel) {
                        targetChannel = fetchedChannel as ChannelData;
                    }
                } catch (error) {
                    console.error('Could not access selected channel:', error);
                    targetChannel = null;
                }
            }
        }
        
        if (!targetChannel) {
            try {
                const guild = await client.rest.get(`/guilds/${guildId}`);
                
                if (guild && typeof guild === 'object' && 'rules_channel_id' in guild && guild.rules_channel_id) {
                    try {
                        const rulesChannel = await client.rest.get(`/channels/${guild.rules_channel_id}`);
                        if (rulesChannel && typeof rulesChannel === 'object' && 'id' in rulesChannel && 'type' in rulesChannel) {
                            targetChannel = rulesChannel as ChannelData;
                        }
                    } catch (error) {
                        // Rules channel might not be accessible
                    }
                }

                if (!targetChannel) {
                    const channels = await client.rest.get(`/guilds/${guildId}/channels`);
                    
                    if (Array.isArray(channels)) {
                        for (const ch of channels) {
                            if (ch && typeof ch === 'object' && 'type' in ch && 'id' in ch) {
                                const channelType = typeof ch.type === 'number' ? ch.type : 0;
                                if (channelType === 0 || channelType === 5 || channelType === 15) {
                                    targetChannel = ch as ChannelData;
                                    break;
                                }
                            }
                        }
                    }

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

        const channelType = targetChannel.type;
        if (channelType !== 0 && channelType !== 5 && channelType !== 15) {
            return interaction.reply({ 
                content: '❌ Please select a text channel.' 
            });
        }

        channelId = targetChannel.id;

        try {

            // Create the invite (never expires)
            const inviteResponse = await client.rest.post(`/channels/${channelId}/invites`, {
                body: {
                    max_age: 0, // Never expires
                    max_uses: maxUses || 0,
                    unique: true
                }
            });

            if (!inviteResponse || typeof inviteResponse !== 'object' || !('code' in inviteResponse)) {
                throw new Error('Invalid invite response');
            }

            const invite = inviteResponse as { code: string };
            const channelName = targetChannel.name || 'Unknown';

            let createdByUserId = '';
            if ('user' in interaction && interaction.user && typeof interaction.user === 'object' && 'id' in interaction.user) {
                createdByUserId = String(interaction.user.id);
            } else if ('member' in interaction && interaction.member && typeof interaction.member === 'object') {
                const member = interaction.member;
                if ('user' in member && member.user && typeof member.user === 'object' && 'id' in member.user) {
                    createdByUserId = String(member.user.id);
                }
            }

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
                createdBy: createdByUserId,
            });

            // Invalidate autocomplete cache
            invalidateInviteCache(guildId);

            // Get total invite count for this guild
            const totalInvites = dbOperations.getInviteCount(guildId);

            const embed = new Embed({
                color: 0x5865F2,
                title: '✅ Invite Created!',
                description: description || undefined,
                fields: [
                    { name: 'Invite Link', value: `https://discord.gg/${invite.code}`, inline: false },
                    { name: 'Primary Source', value: primarySource, inline: true },
                    { name: 'Secondary Source', value: secondarySource, inline: true },
                    { name: 'Channel', value: `<#${channelId}>`, inline: true }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: `${totalInvites} total links` }
            });

            await interaction.reply({ 
                embeds: [embed],
                content: `To make the most of Redirectomator, only share this link on the platform you have designated below.`
            });

            // Log the invite creation
            const guild = await client.rest.get(`/guilds/${guildId}`);
            let logUserId: string | null = null;
            if ('user' in interaction && interaction.user && typeof interaction.user === 'object' && 'id' in interaction.user) {
                logUserId = String(interaction.user.id);
            } else if ('member' in interaction && interaction.member && typeof interaction.member === 'object') {
                const member = interaction.member;
                if ('user' in member && member.user && typeof member.user === 'object' && 'id' in member.user) {
                    logUserId = String(member.user.id);
                }
            }
            await logInviteAction(client, guild, 'created', {
                code: invite.code,
                channelId: channelId,
                primarySource,
                secondarySource,
                description,
                createdBy: logUserId ? `<@${logUserId}>` : 'Unknown',
            });
        } catch (error) {
            console.error('Error creating invite:', error);
            await interaction.reply({ 
                content: '❌ Failed to create invite. Please try again.' 
            });
        }
    }
}
