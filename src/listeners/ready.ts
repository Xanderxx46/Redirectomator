import {
    ReadyListener,
    ListenerEventData
} from "@buape/carbon";

export const inviteCache = new Map<string, Map<string, { uses: number }>>();

export class Ready extends ReadyListener {
    async handle(
        data: ListenerEventData[this["type"]],
        client: Parameters<ReadyListener["handle"]>[1]
    ) {
        if (!data.user) return;
        const username = 'username' in data.user && typeof data.user.username === 'string' ? data.user.username : 'Unknown';
        console.log(`✅ Ready! Logged in as ${username}`);
        
        // Cache all invites on startup
        if ('guilds' in data && Array.isArray(data.guilds)) {
            for (const guild of data.guilds) {
                if (!guild || typeof guild !== 'object' || !('id' in guild)) continue;
                const guildId = String(guild.id);
                const guildName = 'name' in guild && typeof guild.name === 'string' ? guild.name : guildId;
                
                try {
                    // Fetch invites via HTTP API
                    if (!client || typeof client !== 'object' || !('rest' in client) || typeof client.rest !== 'object' || !client.rest || !('get' in client.rest)) {
                        continue;
                    }
                    
                    const invites = await client.rest.get(`/guilds/${guildId}/invites`);
                    const inviteMap = new Map<string, { uses: number }>();
                    
                    if (Array.isArray(invites)) {
                        for (const invite of invites) {
                            if (invite && typeof invite === 'object' && 'code' in invite && typeof invite.code === 'string') {
                                const code = invite.code;
                                const uses = 'uses' in invite && typeof invite.uses === 'number' ? invite.uses : 0;
                                inviteMap.set(code, { uses });
                            }
                        }
                    }
                    
                    inviteCache.set(guildId, inviteMap);
                    console.log(`📋 Cached ${inviteMap.size} invites for ${guildName}`);
                } catch (error) {
                    const errorMessage = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'Unknown error';
                    console.log(`⚠️  Could not fetch invites for ${guildName}: ${errorMessage}`);
                }
            }
        }
    }
}

