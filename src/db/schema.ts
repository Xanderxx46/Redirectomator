import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const invites = sqliteTable('invites', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull().unique(),
    guildId: text('guild_id').notNull(),
    channelId: text('channel_id').notNull(),
    channelName: text('channel_name').notNull(),
    primarySource: text('primary_source').notNull(),
    secondarySource: text('secondary_source').notNull(),
    description: text('description'),
    uses: integer('uses').default(0).notNull(),
    maxUses: integer('max_uses'),
    createdAt: integer('created_at').notNull(),
    createdBy: text('created_by').notNull()
}, (table) => ({
    codeIdx: index('idx_invites_code').on(table.code),
    guildIdx: index('idx_invites_guild').on(table.guildId)
}));

export const inviteUses = sqliteTable('invite_uses', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    inviteId: integer('invite_id').notNull().references(() => invites.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    username: text('username').notNull(),
    usedAt: integer('used_at').notNull()
}, (table) => ({
    inviteIdx: index('idx_invite_uses_invite').on(table.inviteId)
}));

export const logChannels = sqliteTable('log_channels', {
    guildId: text('guild_id').primaryKey(),
    channelId: text('channel_id').notNull(),
    logTypes: text('log_types').default('ALL').notNull()
});

// Types for compatibility with existing code
export type Invite = typeof invites.$inferSelect & {
    guild_id: string;
    channel_id: string;
    channel_name: string;
    primary_source: string;
    secondary_source: string;
    max_uses: number | null;
    created_at: number;
    created_by: string;
};

export type NewInvite = typeof invites.$inferInsert;
export type InviteUse = typeof inviteUses.$inferSelect;
export type NewInviteUse = typeof inviteUses.$inferInsert;
export type LogChannel = typeof logChannels.$inferSelect;
export type NewLogChannel = typeof logChannels.$inferInsert;

