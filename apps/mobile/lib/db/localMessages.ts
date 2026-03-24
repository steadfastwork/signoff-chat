import * as SQLite from "expo-sqlite";

// ---------------------------------------------------------------------------
// Local message archive using expo-sqlite.
// Messages are written here as they arrive over Soketi and from API fetches.
// Expired messages are purged on startup (matching server-side TTL logic).
// ---------------------------------------------------------------------------

const db = SQLite.openDatabaseSync("signoff_messages.db");

export async function createTables(): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cached_messages (
      id             TEXT PRIMARY KEY,
      channel_id     TEXT NOT NULL,
      author_id      TEXT NOT NULL,
      author_name    TEXT NOT NULL,
      content        TEXT NOT NULL,
      media_url      TEXT,
      media_type     TEXT,
      created_at     TEXT NOT NULL,
      expires_at     TEXT NOT NULL,
      synced_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_msgs_channel
      ON cached_messages (channel_id, created_at DESC);
  `);

  // Purge expired messages on every startup
  await db.runAsync(
    `DELETE FROM cached_messages WHERE expires_at < datetime('now')`
  );
}

export async function insertMessage(msg: {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  content: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  createdAt: string;
  expiresAt: string;
}): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO cached_messages
       (id, channel_id, author_id, author_name, content,
        media_url, media_type, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      msg.id,
      msg.channelId,
      msg.authorId,
      msg.authorName,
      msg.content,
      msg.mediaUrl ?? null,
      msg.mediaType ?? null,
      msg.createdAt,
      msg.expiresAt,
    ]
  );
}

export async function getMessages(
  channelId: string,
  limit = 50
): Promise<CachedMessage[]> {
  return db.getAllAsync<CachedMessage>(
    `SELECT * FROM cached_messages
     WHERE channel_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [channelId, limit]
  );
}

export async function deleteMessage(id: string): Promise<void> {
  await db.runAsync(`DELETE FROM cached_messages WHERE id = ?`, [id]);
}

export async function purgeChannelMessages(channelId: string): Promise<void> {
  await db.runAsync(
    `DELETE FROM cached_messages WHERE channel_id = ?`,
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
  created_at: string;
  expires_at: string;
  synced_at: string;
}
