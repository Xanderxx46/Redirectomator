import {
    GuildMemberAddListener,
    ListenerEventData
} from "@buape/carbon";
import { dbOperations } from '../database.js';
import { logInviteAction } from '../utils/logger.js';
import { inviteCache } from './ready.js';

export class GuildMemberAdd extends GuildMemberAddListener {
    async handle(
        data: ListenerEventData[this["type"]],
        client: Parameters<GuildMemberAddListener["handle"]>[1]
    ) {
        try {
            if (!data.guild_id || !data.user) return;
            
            const guildId = typeof data.guild_id === 'string' ? data.guild_id : String(data.guild_id);
            
            if (!client || typeof client !== 'object' || !('rest' in client) || typeof client.rest !== 'object' || !client.rest || !('get' in client.rest)) {
                return;
            }
            
            // Fetch all invites for the guild
            const invitesResponse = await client.rest.get(`/guilds/${guildId}/invites`);
            if (!Array.isArray(invitesResponse)) return;
            
            // Get cached invites
            const cachedInvites = inviteCache.get(guildId) || new Map();
            
            // Find which invite was used
            for (const invite of invitesResponse) {
                if (!invite || typeof invite !== 'object' || !('code' in invite) || typeof invite.code !== 'string') continue;
                
                const code = invite.code;
                const cachedInvite = cachedInvites.get(code);
                const currentUses = 'uses' in invite && typeof invite.uses === 'number' ? invite.uses : 0;
                
                // If uses increased, this invite was used
                if (cachedInvite && currentUses > cachedInvite.uses) {
                    // Check if this invite is tracked in our database
                    const dbInvite = dbOperations.getInviteByCode(code);
                    if (dbInvite) {
                        // Get user info
                        let userId = '';
                        let username = 'Unknown';
                        if (data.user && typeof data.user === 'object') {
                            if ('id' in data.user) {
                                userId = String(data.user.id);
                            }
                            if ('username' in data.user && typeof data.user.username === 'string') {
                                username = data.user.username;
                            }
                        }
                        
                        // Increment uses in database
                        const updatedInvite = dbOperations.incrementInviteUses(
                            dbInvite.id,
                            userId,
                            username
                        );
                        console.log(`✅ Tracked invite use: ${code} by ${username}`);
                        
                        // Log the user join
                        if (updatedInvite) {
                            // Fetch guild for logging
                            const guild = await client.rest.get(`/guilds/${guildId}`);
                            await logInviteAction(client, guild, 'user_joined', {
                                userId: userId,
                                code: dbInvite.code,
                                uses: updatedInvite.uses,
                                primarySource: dbInvite.primary_source,
                                secondarySource: dbInvite.secondary_source,
                            });
                        }
                    }
                    break;
                }
            }
            
            // Update cache
            const inviteMap = new Map<string, { uses: number }>();
            for (const invite of invitesResponse) {
                if (invite && typeof invite === 'object' && 'code' in invite && typeof invite.code === 'string') {
                    const code = invite.code;
                    const uses = 'uses' in invite && typeof invite.uses === 'number' ? invite.uses : 0;
                    inviteMap.set(code, { uses });
                }
            }
            inviteCache.set(guildId, inviteMap);
        } catch (error) {
            console.error('Error tracking invite use:', error);
        }
    }
}

