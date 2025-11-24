import {
    type Client,
    ReadyListener,
    type ListenerEventAdditionalData
} from "@buape/carbon";
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize invite cache
export const inviteCache = new Map<string, Map<string, { uses: number }>>();

export class Ready extends ReadyListener {
    async handle(
        data: ListenerEventAdditionalData,
        client: Client
    ) {
        const readyData = data as any;
        console.log(`✅ Ready! Logged in as ${readyData.user?.username || 'Unknown'}`);
        
        // Cache all invites on startup
        if (readyData.guilds) {
            for (const guild of readyData.guilds) {
                try {
                    // Fetch invites via HTTP API
                    const invites = await client.rest.get(`/guilds/${guild.id}/invites`) as any[];
                    const inviteMap = new Map<string, { uses: number }>();
                    invites.forEach((invite: any) => inviteMap.set(invite.code, { uses: invite.uses || 0 }));
                    inviteCache.set(guild.id, inviteMap);
                    console.log(`📋 Cached ${invites.length} invites for ${guild.name || guild.id}`);
                } catch (error: any) {
                    console.log(`⚠️  Could not fetch invites for ${guild.name || guild.id}: ${error.message}`);
                }
            }
        }
    }
}

