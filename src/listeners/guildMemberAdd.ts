import {
    type Client,
    GuildMemberAddListener,
    type ListenerEventAdditionalData
} from "@buape/carbon";
import { dbOperations } from '../database.js';
import { logInviteAction } from '../utils/logger.js';
import { inviteCache } from './ready.js';

export class GuildMemberAdd extends GuildMemberAddListener {
    async handle(
        data: ListenerEventAdditionalData,
        client: Client
    ) {
        const memberData = data as any;
        try {
            if (!memberData.guild_id || !memberData.user) return;
            
            // Fetch all invites for the guild
            const invites = await client.rest.get(`/guilds/${memberData.guild_id}/invites`) as any[];
            
            // Get cached invites
            const cachedInvites = inviteCache.get(memberData.guild_id) || new Map();
            
            // Find which invite was used
            for (const invite of invites) {
                if (!invite.code) continue;
                const cachedInvite = cachedInvites.get(invite.code);
                
                // If uses increased, this invite was used
                if (cachedInvite && invite.uses > cachedInvite.uses) {
                    // Check if this invite is tracked in our database
                    const dbInvite = dbOperations.getInviteByCode(invite.code);
                    if (dbInvite) {
                        // Increment uses in database
                        const updatedInvite = dbOperations.incrementInviteUses(
                            dbInvite.id,
                            memberData.user.id,
                            memberData.user.username || 'Unknown'
                        );
                        console.log(`✅ Tracked invite use: ${invite.code} by ${memberData.user.username || 'Unknown'}`);
                        
                        // Log the user join
                        if (updatedInvite) {
                            // Fetch guild for logging
                            const guild = await client.rest.get(`/guilds/${memberData.guild_id}`) as any;
                            await logInviteAction(client, guild, 'user_joined', {
                                userId: memberData.user.id,
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
            invites.forEach((invite: any) => {
                if (invite.code) {
                    inviteMap.set(invite.code, { uses: invite.uses || 0 });
                }
            });
            inviteCache.set(memberData.guild_id, inviteMap);
        } catch (error) {
            console.error('Error tracking invite use:', error);
        }
    }
}

