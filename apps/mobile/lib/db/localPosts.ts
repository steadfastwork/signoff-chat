import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("signoff_messages.db");

// ---------------------------------------------------------------------------
// Posts cache — stores up to 500 posts for immediate display on load.
// Not an archive. Purged after 30 days. Server is authoritative.
// ---------------------------------------------------------------------------

export async function createPostsTable(): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cached_posts (
      id               TEXT PRIMARY KEY,
      author_id        TEXT NOT NULL,
      author_name      TEXT NOT NULL,
      author_is_gold   INTEGER NOT NULL DEFAULT 0,
      author_color     TEXT NOT NULL DEFAULT '#f5c842',
      content          TEXT NOT NULL,
      privacy          TEXT NOT NULL DEFAULT 'PUBLIC',
      media_url        TEXT,
      media_type       TEXT,
      nudge_count      INTEGER NOT NULL DEFAULT 0,
      reply_count      INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL,
      cached_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cached_posts_created
      ON cached_posts (created_at DESC);
  `);
  // Purge posts older than 30 days
  await db.runAsync(
    `DELETE FROM cached_posts
     WHERE cached_at < datetime('now', '-30 days')`
  );
}

export async function upsertPosts(posts: CachedPost[]): Promise<void> {
  if (!posts.length) return;
  for (const p of posts) {
    await db.runAsync(
      `INSERT OR REPLACE INTO cached_posts
         (id, author_id, author_name, author_is_gold, author_color,
          content, privacy, media_url, media_type,
          nudge_count, reply_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id, p.author_id, p.author_name,
        p.author_is_gold ? 1 : 0, p.author_color,
        p.content, p.privacy,
        p.media_url ?? null, p.media_type ?? null,
        p.nudge_count, p.reply_count, p.created_at,
      ]
    );
  }
  // Enforce 500-post cap: delete oldest beyond limit
  await db.runAsync(
    `DELETE FROM cached_posts WHERE id NOT IN (
       SELECT id FROM cached_posts ORDER BY created_at DESC LIMIT 500
     )`
  );
}

export async function getCachedPosts(limit = 30): Promise<CachedPost[]> {
  return db.getAllAsync<CachedPost>(
    `SELECT * FROM cached_posts ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

export interface CachedPost {
  id: string;
  author_id: string;
  author_name: string;
  author_is_gold: number; // 0 | 1
  author_color: string;
  content: string;
  privacy: string;
  media_url: string | null;
  media_type: string | null;
  nudge_count: number;
  reply_count: number;
  created_at: string;
  cached_at?: string;
}
