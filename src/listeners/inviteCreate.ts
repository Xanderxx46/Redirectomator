import {
    type Client,
    InviteCreateListener,
    type ListenerEventAdditionalData
} from "@buape/carbon";
import { inviteCache } from './ready.js';

export class InviteCreate extends InviteCreateListener {
    async handle(
        data: ListenerEventAdditionalData,
        client: Client
    ) {
        const inviteData = data as any;
        if (!inviteData.guild_id || !inviteData.code) return;
        const guildCache = inviteCache.get(inviteData.guild_id) || new Map();
        guildCache.set(inviteData.code, { uses: inviteData.uses || 0 });
        inviteCache.set(inviteData.guild_id, guildCache);
    }
}

