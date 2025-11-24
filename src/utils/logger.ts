import { dbOperations } from '../database.js';
import { Embed } from '@buape/carbon';

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
    client: any,
    guild: any,
    action: 'created' | 'deleted' | 'user_joined',
    data: LogData
) {
    const guildId = typeof guild === 'string' ? guild : guild?.id;
    if (!guildId) {
        console.error('logInviteAction: No guild ID provided');
        return;
    }

    const logConfig = dbOperations.getLogChannel(guildId) as { channel_id: string; log_types?: string } | undefined;
    if (!logConfig) return;

    try {
        // Fetch channel using REST API (Carbon doesn't have guild.channels.fetch)
        const channel = await client.rest.get(`/channels/${logConfig.channel_id}`) as any;
        if (!channel) return;
        
        // Check if channel is a text channel (type 0 = text, 5 = news, 15 = forum)
        const channelType = channel.type;
        if (channelType !== 0 && channelType !== 5 && channelType !== 15) return;

        let embed: Embed;

        switch (action) {
            case 'created':
                const createdFields: any[] = [
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

        // Send message using REST API
        await client.rest.post(`/channels/${logConfig.channel_id}/messages`, {
            body: { embeds: [embed.serialize()] }
        });
    } catch (error) {
        console.error('Error logging invite action:', error);
    }
}

