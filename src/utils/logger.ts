import { dbOperations } from '../database.js';
import { Client, Embed, Guild, ChannelType} from '@buape/carbon';

interface LogData {
    code?: string;
    channelId?: string;
    primarySource?: string;
    secondarySource?: string;
    description?: string;
    createdBy?: string;
    deletedBy?: string;
    uses?: number;
    userId?: string;
}

export async function logInviteAction(
    client: Client,
    guild: Guild | string | unknown,
    action: 'created' | 'deleted' | 'user_joined',
    data: LogData
) {
    let guildId: string | null = null;
    if (typeof guild === 'string') {
        guildId = guild;
    } else if (guild && typeof guild === 'object' && 'id' in guild) {
        guildId = String(guild.id);
    }
    
    if (!guildId) {
        console.error('logInviteAction: No guild ID provided');
        return;
    }

    const logConfig = dbOperations.getLogChannel(guildId);
    if (!logConfig || typeof logConfig !== 'object' || !('channel_id' in logConfig) || typeof logConfig.channel_id !== 'string') return;

    try {
        // Fetch channel using Carbon's fetchChannel method
        if (!('fetchChannel' in client) || typeof client.fetchChannel !== 'function') {
            console.error('logInviteAction: fetchChannel method not available');
            return;
        }

        const channel = await client.fetchChannel(logConfig.channel_id);
        if (!channel) return;
        
        // Check if channel is a guild text channel
        if (!('type' in channel) || channel.type !== ChannelType.GuildText) return;

        let embed: Embed;

        switch (action) {
            case 'created':
                const createdFields: Array<{ name: string; value: string; inline: boolean }> = [
                    { name: 'Primary Source', value: data.primarySource || '', inline: true },
                    { name: 'Secondary Source', value: data.secondarySource || '', inline: true },
                    { name: 'Channel', value: `<#${data.channelId}>`, inline: true }
                ];

                if (data.description) {
                    createdFields.push({ name: 'Description', value: data.description, inline: false });
                }

                embed = new Embed({
                    color: 0x5865F2,
                    title: '✅ Invite Created',
                    description: `The invite \`${data.code}\` was created by ${data.createdBy}.`,
                    fields: createdFields,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'deleted':
                embed = new Embed({
                    color: 0xED4245,
                    title: '🗑️ Invite Deleted',
                    description: `The invite \`${data.code}\` was deleted by ${data.deletedBy}.`,
                    fields: [
                        { name: 'Primary Source', value: data.primarySource || '', inline: true },
                        { name: 'Secondary Source', value: data.secondarySource || '', inline: true },
                        { name: 'Total Uses', value: `${data.uses}`, inline: true }
                    ],
                    timestamp: new Date().toISOString()
                });
                break;

            case 'user_joined':
                embed = new Embed({
                    color: 0x57F287,
                    title: '👤 User Joined',
                    fields: [
                        { name: 'User Mention', value: `<@${data.userId}>`, inline: true },
                        { name: 'User ID', value: data.userId || '', inline: true },
                        { name: 'Invite', value: `\`.gg/${data.code}\` (${data.uses} uses)`, inline: false },
                        { name: 'Primary Source', value: data.primarySource || '', inline: true },
                        { name: 'Secondary Source', value: data.secondarySource || '', inline: true }
                    ],
                    timestamp: new Date().toISOString()
                });
                break;

            default:
                return;
        }

        // Send message using channel's send method
        if (!('send' in channel) || typeof channel.send !== 'function') {
            console.error('logInviteAction: Channel does not have a send method');
            return;
        }

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging invite action:', error);
    }
}

