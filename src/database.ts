import { db } from './db/index.js';
import { invites, inviteUses, logChannels } from './db/schema.js';
import { eq, desc, sql, count } from 'drizzle-orm';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database, { type Database as DatabaseType } from 'better-sqlite3';

// Get the underlying database connection for raw SQL
const getRawDb = (): DatabaseType => (db as any).$client;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize database connection for migrations/setup
const sqlite = new Database(join(__dirname, '..', 'invites.db'));
sqlite.pragma('foreign_keys = ON');

// Create tables if they don't exist (for initial setup)
sqlite.exec(`
    CREATE TABLE IF NOT EXISTS invites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_name TEXT NOT NULL,
        primary_source TEXT NOT NULL,
        secondary_source TEXT NOT NULL,
        description TEXT,
        uses INTEGER DEFAULT 0,
        max_uses INTEGER,
        created_at INTEGER NOT NULL,
        created_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invite_uses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invite_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        used_at INTEGER NOT NULL,
        FOREIGN KEY (invite_id) REFERENCES invites(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS log_channels (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        log_types TEXT DEFAULT 'ALL'
    );

    CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);
    CREATE INDEX IF NOT EXISTS idx_invites_guild ON invites(guild_id);
    CREATE INDEX IF NOT EXISTS idx_invite_uses_invite ON invite_uses(invite_id);
`);

interface InviteData {
    code: string;
    guildId: string;
    channelId: string;
    channelName: string;
    primarySource: string;
    secondarySource: string;
    description?: string | null;
    maxUses?: number | null;
    createdBy: string;
}

interface InviteUpdate {
    primarySource?: string;
    secondarySource?: string;
    description?: string | null;
    maxUses?: number | null;
}

// Legacy interface for backward compatibility
interface Invite {
    id: number;
    code: string;
    guild_id: string;
    channel_id: string;
    channel_name: string;
    primary_source: string;
    secondary_source: string;
    description: string | null;
    uses: number;
    max_uses: number | null;
    created_at: number;
    created_by: string;
}

// Helper function to convert Drizzle invite to legacy format
function toLegacyInvite(invite: typeof invites.$inferSelect): Invite {
    return {
        id: invite.id,
        code: invite.code,
        guild_id: invite.guildId,
        channel_id: invite.channelId,
        channel_name: invite.channelName,
        primary_source: invite.primarySource,
        secondary_source: invite.secondarySource,
        description: invite.description,
        uses: invite.uses,
        max_uses: invite.maxUses,
        created_at: invite.createdAt,
        created_by: invite.createdBy
    };
}

// Database operations
export const dbOperations = {
    // Create a new invite
    createInvite(data: InviteData) {
        const result = db.insert(invites).values({
            code: data.code,
            guildId: data.guildId,
            channelId: data.channelId,
            channelName: data.channelName,
            primarySource: data.primarySource,
            secondarySource: data.secondarySource,
            description: data.description || null,
            maxUses: data.maxUses || null,
            createdAt: Date.now(),
            createdBy: data.createdBy
        }).returning().get();

        return {
            lastInsertRowid: result.id,
            changes: 1
        };
    },

    // Get all invites for a guild
    getInvitesByGuild(guildId: string): Invite[] {
        const results = db.select().from(invites)
            .where(eq(invites.guildId, guildId))
            .orderBy(desc(invites.createdAt))
            .all();

        return results.map(toLegacyInvite);
    },

    // Get invite by code
    getInviteByCode(code: string): Invite | undefined {
        const result = db.select().from(invites)
            .where(eq(invites.code, code))
            .get();

        return result ? toLegacyInvite(result) : undefined;
    },

    // Get invite by ID
    getInviteById(id: number): Invite | undefined {
        const result = db.select().from(invites)
            .where(eq(invites.id, id))
            .get();

        return result ? toLegacyInvite(result) : undefined;
    },

    // Increment invite uses
    incrementInviteUses(inviteId: number, userId: string, username: string): Invite | null {
        const invite = this.getInviteById(inviteId);
        if (!invite) return null;

        // Check max uses
        if (invite.max_uses && invite.uses >= invite.max_uses) {
            return null;
        }

        // Update uses count - use raw SQL for increment
        const rawDb = getRawDb();
        rawDb.prepare('UPDATE invites SET uses = uses + 1 WHERE id = ?').run(inviteId);

        // Log the use
        db.insert(inviteUses).values({
            inviteId: inviteId,
            userId: userId,
            username: username,
            usedAt: Date.now()
        }).run();

        return this.getInviteById(inviteId) || null;
    },

    // Get invite usage stats
    getInviteStats(inviteId: number) {
        const result = db.select({
            id: invites.id,
            code: invites.code,
            guildId: invites.guildId,
            channelId: invites.channelId,
            channelName: invites.channelName,
            primarySource: invites.primarySource,
            secondarySource: invites.secondarySource,
            description: invites.description,
            uses: invites.uses,
            maxUses: invites.maxUses,
            createdAt: invites.createdAt,
            createdBy: invites.createdBy,
            totalUses: sql<number>`COUNT(${inviteUses.id})`.as('total_uses'),
            uniqueDays: sql<number>`COUNT(DISTINCT CAST(${inviteUses.usedAt} / 86400000 AS INTEGER))`.as('unique_days')
        })
        .from(invites)
        .leftJoin(inviteUses, eq(invites.id, inviteUses.inviteId))
        .where(eq(invites.id, inviteId))
        .groupBy(invites.id)
        .get();

        if (!result) return null;

        return {
            ...toLegacyInvite(result as any),
            total_uses: Number(result.totalUses) || 0,
            unique_days: Number(result.uniqueDays) || 0
        };
    },

    // Get recent uses for an invite
    getRecentUses(inviteId: number, limit = 10) {
        return db.select().from(inviteUses)
            .where(eq(inviteUses.inviteId, inviteId))
            .orderBy(desc(inviteUses.usedAt))
            .limit(limit)
            .all();
    },

    // Delete an invite
    deleteInvite(id: number) {
        const result = db.delete(invites)
            .where(eq(invites.id, id))
            .returning()
            .get();

        return {
            lastInsertRowid: result?.id || 0,
            changes: result ? 1 : 0
        };
    },

    // Get total invite count for a guild
    getInviteCount(guildId: string): number {
        const result = db.select({ count: count() })
            .from(invites)
            .where(eq(invites.guildId, guildId))
            .get();

        return result?.count || 0;
    },

    // Update invite information
    updateInvite(id: number, updates: InviteUpdate): Invite | null {
        const updateData: Partial<typeof invites.$inferInsert> = {};

        if (updates.primarySource !== undefined) {
            updateData.primarySource = updates.primarySource;
        }
        if (updates.secondarySource !== undefined) {
            updateData.secondarySource = updates.secondarySource;
        }
        if (updates.description !== undefined) {
            updateData.description = updates.description || null;
        }
        if (updates.maxUses !== undefined) {
            updateData.maxUses = updates.maxUses || null;
        }

        if (Object.keys(updateData).length === 0) {
            return null;
        }

        const result = db.update(invites)
            .set(updateData)
            .where(eq(invites.id, id))
            .returning()
            .get();

        return result ? toLegacyInvite(result) : null;
    },

    // Get top invites by usage for a guild
    getTopInvites(guildId: string, limit = 10): Invite[] {
        const results = db.select().from(invites)
            .where(eq(invites.guildId, guildId))
            .orderBy(desc(invites.uses))
            .limit(limit)
            .all();

        return results.map(toLegacyInvite);
    },

    // Set log channel for a guild
    setLogChannel(guildId: string, channelId: string, logTypes = 'ALL') {
        db.insert(logChannels)
            .values({
                guildId: guildId,
                channelId: channelId,
                logTypes: logTypes
            })
            .onConflictDoUpdate({
                target: logChannels.guildId,
                set: {
                    channelId: channelId,
                    logTypes: logTypes
                }
            })
            .run();

        return {
            lastInsertRowid: 0,
            changes: 1
        };
    },

    // Get log channel for a guild
    getLogChannel(guildId: string) {
        const result = db.select().from(logChannels)
            .where(eq(logChannels.guildId, guildId))
            .get();

        if (!result) return undefined;

        // Convert to legacy format
        return {
            guild_id: result.guildId,
            channel_id: result.channelId,
            log_types: result.logTypes
        };
    },

    // Remove log channel for a guild
    removeLogChannel(guildId: string) {
        const result = db.delete(logChannels)
            .where(eq(logChannels.guildId, guildId))
            .returning()
            .get();

        return {
            lastInsertRowid: 0,
            changes: result ? 1 : 0
        };
    }
};

export default db;
export type { Invite, InviteData, InviteUpdate };
