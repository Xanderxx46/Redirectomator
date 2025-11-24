import {
    type Client,
    InviteDeleteListener,
    type ListenerEventAdditionalData
} from "@buape/carbon";
import { inviteCache } from './ready.js';

export class InviteDelete extends InviteDeleteListener {
    async handle(
        data: ListenerEventAdditionalData,
        client: Client
    ) {
        const inviteData = data as any;
        if (!inviteData.guild_id || !inviteData.code) return;
        if (inviteCache.has(inviteData.guild_id)) {
            inviteCache.get(inviteData.guild_id)?.delete(inviteData.code);
        }
    }
}

