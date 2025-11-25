import {
    InviteDeleteListener,
    ListenerEventData
} from "@buape/carbon";
import { inviteCache } from './ready.js';

export class InviteDelete extends InviteDeleteListener {
    async handle(
        data: ListenerEventData[this["type"]],
    ) {
        if (!data.guild_id || !data.code) return;
        if (inviteCache.has(data.guild_id)) {
            inviteCache.get(data.guild_id)?.delete(data.code);
        }
    }
}
