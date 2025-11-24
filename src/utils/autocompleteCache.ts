// Cache for autocomplete data to improve performance
const inviteCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export function getCachedInvites(guildId: string, getInvites: () => any[]): any[] {
    const cached = inviteCache.get(guildId);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        return cached.data;
    }
    
    const invites = getInvites();
    inviteCache.set(guildId, { data: invites, timestamp: now });
    return invites;
}

export function invalidateInviteCache(guildId: string) {
    inviteCache.delete(guildId);
}

// Pre-defined source lists for faster autocomplete
export const PRIMARY_SOURCES = [
    'Instagram', 'Twitter', 'YouTube', 'TikTok', 'Facebook',
    'Reddit', 'Discord', 'Telegram', 'LinkedIn', 'Website',
    'Email', 'Other'
];

export const SECONDARY_SOURCES = [
    'Link in Bio', 'Post', 'Story', 'Reel', 'Video',
    'Comment', 'DM', 'Message', 'Profile', 'About Me',
    'Navigation Link', 'Button', 'Support Button', 'Help Embed',
    'Information Embed', 'Overview Page', 'Homepage', 'Other'
];

// Fast filter function for autocomplete
export function filterAutocomplete<T>(
    items: T[],
    searchValue: string,
    getSearchableText: (item: T) => string,
    limit: number = 25
): T[] {
    if (!searchValue) {
        return items.slice(0, limit);
    }
    
    const lowerSearch = searchValue.toLowerCase();
    const filtered: { item: T; score: number }[] = [];
    
    for (const item of items) {
        const text = getSearchableText(item).toLowerCase();
        if (text.includes(lowerSearch)) {
            // Score: exact match at start = highest, contains = lower
            let score = 0;
            if (text.startsWith(lowerSearch)) {
                score = 100;
            } else if (text.includes(lowerSearch)) {
                score = 50;
            }
            filtered.push({ item, score });
        }
    }
    
    // Sort by score (highest first), then alphabetically
    filtered.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return getSearchableText(a.item).localeCompare(getSearchableText(b.item));
    });
    
    return filtered.slice(0, limit).map(f => f.item);
}

