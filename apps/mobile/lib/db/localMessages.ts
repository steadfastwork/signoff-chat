import * as SQLite from "expo-sqlite";

// ---------------------------------------------------------------------------
// Local message archive using expo-sqlite.
// Messages are written here as they arrive over Soketi and from API fetches.
// Expired messages are purged on startup (matching server-side TTL logic).
// ---------------------------------------------------------------------------

// Module-level singleton — used by all functions that don't receive a db param.
const _db = SQLite.openDatabaseSync("signoff_messages.db");

/** Returns the module-level SQLite database instance. */
export function openDatabase(): ReturnType<typeof SQLite.openDatabaseSync> {
  return _db;
}

/**
 * Create all local tables. Accepts an optional db param so tests can pass a
 * mock db; defaults to the module-level singleton.
 */
export async function createTables(
  db: ReturnType<typeof SQLite.openDatabaseSync> = _db
): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS channel_messages (
      id             TEXT PRIMARY KEY,
      channel_id     TEXT NOT NULL,
      author_id      TEXT NOT NULL,
      author_name    TEXT NOT NULL,
      content        TEXT NOT NULL,
      media_url      TEXT,
      media_type     TEXT,
      gif_url        TEXT,
      gif_title      TEXT,
      created_at     TEXT NOT NULL,
      expires_at     TEXT NOT NULL,
      synced_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_msgs_channel
      ON channel_messages (channel_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS feed_posts (
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

    CREATE INDEX IF NOT EXISTS idx_feed_posts_created
      ON feed_posts (created_at DESC);
  `);

  // Purge expired messages on every startup
  await db.runAsync(
    `DELETE FROM channel_messages WHERE expires_at < datetime('now')`
  );
}

/**
 * Insert or replace a message. Accepts an explicit db for testability.
 */
export async function saveMessage(
  db: ReturnType<typeof SQLite.openDatabaseSync>,
  msg: {
    id: string;
    channelId: string;
    authorId: string;
    authorName: string;
    content: string;
    mediaUrl?: string | null;
    mediaType?: string | null;
    gifUrl?: string | null;
    gifTitle?: string | null;
    createdAt: string;
    expiresAt: string;
  }
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO channel_messages
       (id, channel_id, author_id, author_name, content,
        media_url, media_type, gif_url, gif_title, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      msg.id,
      msg.channelId,
      msg.authorId,
      msg.authorName,
      msg.content,
      msg.mediaUrl ?? null,
      msg.mediaType ?? null,
      msg.gifUrl ?? null,
      msg.gifTitle ?? null,
      msg.createdAt,
      msg.expiresAt,
    ]
  );
}

/** Convenience wrapper using the module-level db. */
export async function insertMessage(msg: {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  content: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  gifUrl?: string | null;
  gifTitle?: string | null;
  createdAt: string;
  expiresAt: string;
}): Promise<void> {
  return saveMessage(_db, msg);
}

/**
 * Retrieve messages for a channel, most recent first.
 */
export async function getMessages(
  channelId: string,
  limit = 50
): Promise<CachedMessage[]> {
  return _db.getAllAsync<CachedMessage>(
    `SELECT * FROM channel_messages
     WHERE channel_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [channelId, limit]
  );
}

/**
 * Retrieve messages using an explicit db (for testing).
 */
export async function getChannelMessages(
  db: ReturnType<typeof SQLite.openDatabaseSync>,
  channelId: string,
  limit = 50
): Promise<CachedMessage[]> {
  return db.getAllAsync<CachedMessage>(
    `SELECT * FROM channel_messages
     WHERE channel_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [channelId, limit]
  );
}

export async function deleteMessage(id: string): Promise<void> {
  await _db.runAsync(`DELETE FROM channel_messages WHERE id = ?`, [id]);
}

export async function purgeChannelMessages(channelId: string): Promise<void> {
  await _db.runAsync(
    `DELETE FROM channel_messages WHERE channel_id = ?`,
    [channelId]
  );
}

export interface CachedMessage {
  id: string;
  channel_id: string;
  author_id: string;
  author_name: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  gif_url: string | null;
  gif_title: string | null;
  created_at: string;
  expires_at: string;
  synced_at: string;
  // Runtime fields — populated from server response, NOT persisted in SQLite
  author_is_gold?: boolean;
  reply_count?: number;
  last_reply_by?: string | null;
  text_color?: string | null;
  font_size?: string | null;
}
