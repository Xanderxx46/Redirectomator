import { Command, type CommandInteraction, ApplicationCommandOptionType, Embed } from '@buape/carbon';
import { dbOperations } from '../database.js';

export default class SetChannelCommand extends Command {
    name = 'setchannel';
    description = 'Set the log channel for invite actions';

    options = [
        {
            name: 'channel',
            type: ApplicationCommandOptionType.Channel,
            description: 'The channel to send logs to',
            required: true
        }
    ] as any;

    async run(interaction: CommandInteraction) {
        const client = (interaction as any).client;
        
        // Extract channel ID from raw interaction data first (most reliable)
        const interactionData = (interaction as any).data || (interaction as any).rawData;
        let channelId: string | null = null;
        
        if (interactionData?.options) {
            const channelOption = interactionData.options.find((opt: any) => opt.name === 'channel');
            if (channelOption?.value) {
                channelId = String(channelOption.value);
            }
        }
        
        // If we got the channel ID from interaction data, use it
        // Otherwise, try to get it from the channel object (which might be a Promise)
        if (!channelId) {
            let channel = interaction.options.getChannel('channel');
            
            // Handle Promise if getChannel returns one
            if (channel && typeof (channel as any).then === 'function') {
                channel = await (channel as any);
            }
            
            if (!channel) {
                return interaction.reply({ 
                    content: '❌ Please select a channel.'
                });
            }
            
            // Extract ID from channel object
            if (typeof channel === 'string') {
                channelId = channel;
            } else if ((channel as any)?.id) {
                channelId = String((channel as any).id);
            } else if ((channel as any)?.value) {
                channelId = String((channel as any).value);
            }
        }

        // If still no channel ID, log for debugging
        if (!channelId) {
            console.error('Could not extract channel ID.');
            console.error('Interaction data:', JSON.stringify(interactionData, null, 2));
            return interaction.reply({ 
                content: '❌ Could not determine channel ID. Please try again or contact support.'
            });
        }

        // Fetch full channel data to verify type
        let channelData: any;
        try {
            channelData = await client.rest.get(`/channels/${channelId}`) as any;
        } catch (error: any) {
            console.error('Error fetching channel:', error);
            // Provide more helpful error message
            if (error.status === 404) {
                return interaction.reply({ 
                    content: '❌ Channel not found. Make sure the channel exists and the bot has access to it.'
                });
            } else if (error.status === 403) {
                return interaction.reply({ 
                    content: '❌ Bot does not have permission to access this channel.'
                });
            }
            return interaction.reply({ 
                content: '❌ Could not access the selected channel. Please try again.'
            });
        }

        // Check if channel is a text channel
        const channelType = channelData.type;
        if (channelType !== 0 && channelType !== 5 && channelType !== 15) { // Not a text channel
            return interaction.reply({ 
                content: '❌ Please select a text channel.'
            });
        }
        try {
            // Try to get channel permissions
            const guildId = (interaction as any).guild_id || (interaction as any).guild?.id;
            const botMember = await client.rest.get(`/guilds/${guildId}/members/${client.user?.id || (await client.rest.get('/users/@me') as any).id}`) as any;
            // Note: Permission checking might need additional API calls
            // For now, we'll just try to set it and let Discord handle permission errors
        } catch (error) {
            // Continue anyway
        }

        try {
            const guildId = (interaction as any).guild_id || (interaction as any).guild?.id;
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

