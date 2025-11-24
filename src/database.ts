import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize database
const db: DatabaseType = new Database(join(__dirname, '..', 'invites.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables if they don't exist
db.exec(`
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

// Database operations
export const dbOperations = {
    // Create a new invite
    createInvite(data: InviteData) {
        const stmt = db.prepare(`
            INSERT INTO invites (code, guild_id, channel_id, channel_name, primary_source, secondary_source, description, max_uses, created_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        return stmt.run(
            data.code,
            data.guildId,
            data.channelId,
            data.channelName,
            data.primarySource,
            data.secondarySource,
            data.description || null,
            data.maxUses || null,
            Date.now(),
            data.createdBy
        );
    },

    // Get all invites for a guild
    getInvitesByGuild(guildId: string): Invite[] {
        const stmt = db.prepare(`
            SELECT * FROM invites WHERE guild_id = ? ORDER BY created_at DESC
        `);
        return stmt.all(guildId) as Invite[];
    },

    // Get invite by code
    getInviteByCode(code: string): Invite | undefined {
        const stmt = db.prepare('SELECT * FROM invites WHERE code = ?');
        return stmt.get(code) as Invite | undefined;
    },

    // Get invite by ID
    getInviteById(id: number): Invite | undefined {
        const stmt = db.prepare('SELECT * FROM invites WHERE id = ?');
        return stmt.get(id) as Invite | undefined;
    },

    // Increment invite uses
    incrementInviteUses(inviteId: number, userId: string, username: string): Invite | null {
        const invite = this.getInviteById(inviteId);
        if (!invite) return null;

        // Check max uses
        if (invite.max_uses && invite.uses >= invite.max_uses) {
            return null;
        }

        // Update uses count
        const updateStmt = db.prepare('UPDATE invites SET uses = uses + 1 WHERE id = ?');
        updateStmt.run(inviteId);

        // Log the use
        const logStmt = db.prepare(`
            INSERT INTO invite_uses (invite_id, user_id, username, used_at)
            VALUES (?, ?, ?, ?)
        `);
        logStmt.run(inviteId, userId, username, Date.now());

        return this.getInviteById(inviteId) || null;
    },

    // Get invite usage stats
    getInviteStats(inviteId: number) {
        const stmt = db.prepare(`
            SELECT 
                i.*,
                COUNT(iu.id) as total_uses,
                COUNT(DISTINCT DATE(iu.used_at / 86400000)) as unique_days
            FROM invites i
            LEFT JOIN invite_uses iu ON i.id = iu.invite_id
            WHERE i.id = ?
            GROUP BY i.id
        `);
        return stmt.get(inviteId);
    },

    // Get recent uses for an invite
    getRecentUses(inviteId: number, limit = 10) {
        const stmt = db.prepare(`
            SELECT * FROM invite_uses 
            WHERE invite_id = ? 
            ORDER BY used_at DESC 
            LIMIT ?
        `);
        return stmt.all(inviteId, limit);
    },

    // Delete an invite
    deleteInvite(id: number) {
        const stmt = db.prepare('DELETE FROM invites WHERE id = ?');
        return stmt.run(id);
    },

    // Get total invite count for a guild
    getInviteCount(guildId: string): number {
        const stmt = db.prepare('SELECT COUNT(*) as count FROM invites WHERE guild_id = ?');
        const result = stmt.get(guildId) as { count: number };
        return result.count;
    },

    // Update invite information
    updateInvite(id: number, updates: InviteUpdate): Invite | null {
        const fields: string[] = [];
        const values: any[] = [];

        if (updates.primarySource !== undefined) {
            fields.push('primary_source = ?');
            values.push(updates.primarySource);
        }
        if (updates.secondarySource !== undefined) {
            fields.push('secondary_source = ?');
            values.push(updates.secondarySource);
        }
        if (updates.description !== undefined) {
            fields.push('description = ?');
            values.push(updates.description || null);
        }
        if (updates.maxUses !== undefined) {
            fields.push('max_uses = ?');
            values.push(updates.maxUses || null);
        }

        if (fields.length === 0) {
            return null;
        }

        values.push(id);
        const stmt = db.prepare(`UPDATE invites SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values);

        return this.getInviteById(id) || null;
    },

    // Get top invites by usage for a guild
    getTopInvites(guildId: string, limit = 10): Invite[] {
        const stmt = db.prepare(`
            SELECT * FROM invites 
            WHERE guild_id = ? 
            ORDER BY uses DESC 
            LIMIT ?
        `);
        return stmt.all(guildId, limit) as Invite[];
    },

    // Set log channel for a guild
    setLogChannel(guildId: string, channelId: string, logTypes = 'ALL') {
        const stmt = db.prepare(`
            INSERT INTO log_channels (guild_id, channel_id, log_types)
            VALUES (?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET channel_id = ?, log_types = ?
        `);
        return stmt.run(guildId, channelId, logTypes, channelId, logTypes);
    },

    // Get log channel for a guild
    getLogChannel(guildId: string) {
        const stmt = db.prepare('SELECT * FROM log_channels WHERE guild_id = ?');
        return stmt.get(guildId);
    },

    // Remove log channel for a guild
    removeLogChannel(guildId: string) {
        const stmt = db.prepare('DELETE FROM log_channels WHERE guild_id = ?');
        return stmt.run(guildId);
    }
};

export default db;
export type { Invite, InviteData, InviteUpdate };

