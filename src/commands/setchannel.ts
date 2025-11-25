import { Command, type CommandInteraction, ApplicationCommandOptionType, Embed } from '@buape/carbon';
import { dbOperations } from '../database.js';

export default class SetChannelCommand extends Command {
    name = 'setchannel';
    description = 'Set the log channel for invite actions';

    options = [
        {
            name: 'channel',
            type: ApplicationCommandOptionType.Channel as const,
            description: 'The channel to send logs to',
            required: true
        }
    ]

    async run(interaction: CommandInteraction) {
        if (!('client' in interaction) || !interaction.client || !('rest' in interaction.client) || typeof interaction.client.rest !== 'object' || !interaction.client.rest || !('get' in interaction.client.rest)) {
            return interaction.reply({ 
                content: '❌ Client not available.' 
            });
        }

        const client = interaction.client;
        
        // Extract channel ID from raw interaction data first (most reliable)
        let interactionData: { options?: Array<{ name: string; value?: unknown }> } | null = null;
        if ('data' in interaction && interaction.data && typeof interaction.data === 'object') {
            interactionData = interaction.data as { options?: Array<{ name: string; value?: unknown }> };
        } else if ('rawData' in interaction && interaction.rawData && typeof interaction.rawData === 'object') {
            interactionData = interaction.rawData as { options?: Array<{ name: string; value?: unknown }> };
        }

        let channelId: string | null = null;
        
        if (interactionData?.options) {
            const channelOption = interactionData.options.find((opt) => opt.name === 'channel');
            if (channelOption && 'value' in channelOption && channelOption.value) {
                channelId = String(channelOption.value);
            }
        }
        
        // If we got the channel ID from interaction data, use it
        // Otherwise, try to get it from the channel object (which might be a Promise)
        if (!channelId) {
            const channelResult = interaction.options.getChannel('channel');
            let channel: unknown = channelResult;
            
            // Handle Promise if getChannel returns one
            if (channel && typeof channel === 'object' && channel !== null && 'then' in channel && typeof channel.then === 'function') {
                channel = await (channel as Promise<unknown>);
            }
            
            if (!channel) {
                return interaction.reply({ 
                    content: '❌ Please select a channel.'
                });
            }
            
            // Extract ID from channel object
            if (typeof channel === 'string') {
                channelId = channel;
            } else if (typeof channel === 'object' && channel !== null && 'id' in channel) {
                channelId = String(channel.id);
            } else if (typeof channel === 'object' && channel !== null && 'value' in channel) {
                channelId = String(channel.value);
            }
        }

        // If still no channel ID, log for debugging
        if (!channelId) {
            console.error('Could not extract channel ID.');
            return interaction.reply({ 
                content: '❌ Could not determine channel ID. Please try again or contact support.'
            });
        }

        // Fetch full channel data to verify type
        interface ChannelData {
            type: number;
        }

        let channelData: ChannelData | null = null;
        try {
            const fetchedChannel = await client.rest.get(`/channels/${channelId}`);
            if (fetchedChannel && typeof fetchedChannel === 'object' && 'type' in fetchedChannel) {
                channelData = fetchedChannel as ChannelData;
            }
        } catch (error) {
            console.error('Error fetching channel:', error);
            const errorObj = error && typeof error === 'object' && 'status' in error ? error as { status?: number } : null;
            if (errorObj?.status === 404) {
                return interaction.reply({ 
                    content: '❌ Channel not found. Make sure the channel exists and the bot has access to it.'
                });
            } else if (errorObj?.status === 403) {
                return interaction.reply({ 
                    content: '❌ Bot does not have permission to access this channel.'
                });
            }
            return interaction.reply({ 
                content: '❌ Could not access the selected channel. Please try again.'
            });
        }

        if (!channelData) {
            return interaction.reply({ 
                content: '❌ Could not fetch channel data.'
            });
        }

        // Check if channel is a text channel
        const channelType = channelData.type;
        if (channelType !== 0 && channelType !== 5 && channelType !== 15) {
            return interaction.reply({ 
                content: '❌ Please select a text channel.'
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

        try {
            dbOperations.setLogChannel(guildId, channelId, 'ALL');

            const embed = new Embed({
                color: 0x5865F2,
                title: '✅ Log Channel Set!',
                fields: [
                    { name: 'Channel', value: `<#${channelId}>`, inline: true }
                ],
                timestamp: new Date().toISOString()
            });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error setting log channel:', error);
            await interaction.reply({ 
                content: '❌ Failed to set log channel. Please try again.'
            });
        }
    }
}

