import {
    InviteCreateListener,
    ListenerEventData
} from "@buape/carbon";
import { inviteCache } from './ready.js';

export class InviteCreate extends InviteCreateListener {
    async handle(
        data: ListenerEventData[this["type"]],
    ) {;
        if (!data.guild_id || !data.code) return;
        const guildCache = inviteCache.get(data.guild_id) || new Map();
        guildCache.set(data.code, { uses: data.uses || 0 });
        inviteCache.set(data.guild_id, guildCache);
    }
}

