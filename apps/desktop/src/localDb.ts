/**
 * Local message archive — better-sqlite3.
 *
 * Philosophy:
 *   Server = relay.  Messages expire there after 30 days.
 *   Device = archive. Messages here are NEVER auto-deleted.
 *
 * Path (resolved by Electron):
 *   macOS:   ~/Library/Application Support/Signoff Chat/messages.db
 *   Windows: %APPDATA%\Signoff Chat\messages.db
 *   Linux:   ~/.config/Signoff Chat/messages.db
 */

import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocalMessage {
  id: string;
  channelId: string;
  senderId: string;
  screenname: string;
  encryptedContent?: string | null;
  decryptedContent?: string | null;
  iv?: string | null;
  gifUrl?: string | null;
  gifTitle?: string | null;
  createdAt: string;
  isThread: boolean;
  parentMessageId?: string | null;
  localOnly: boolean;
  cachedAt: string;
}

export interface LocalPost {
  id: string;
  authorId?: string | null;
  screenname?: string | null;
  content?: string | null;
  mediaUrl?: string | null;
  isAwayMessage: boolean;
  privacy?: string | null;
  nudgeCount: number;
  createdAt?: string | null;
  cachedAt: string;
}

// ---------------------------------------------------------------------------
// Database instance (module-level singleton)
// ---------------------------------------------------------------------------

let db: Database.Database | null = null;

// ---------------------------------------------------------------------------
// initDb — call once from main.ts after app is ready
// ---------------------------------------------------------------------------

export function initDb(): Database.Database {
  const dbPath = path.join(app.getPath("userData"), "messages.db");

  db = new Database(dbPath);

  // WAL gives better concurrent read performance (renderer reads while main writes)
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  // Protect against corruption on power loss
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS channel_messages (
      id               TEXT PRIMARY KEY,
      channelId        TEXT NOT NULL,
      senderId         TEXT NOT NULL,
      screenname       TEXT NOT NULL,
      encryptedContent TEXT,
      decryptedContent TEXT,
      iv               TEXT,
      gifUrl           TEXT,
      gifTitle         TEXT,
      createdAt        TEXT NOT NULL,
      isThread         INTEGER DEFAULT 0,
      parentMessageId  TEXT,
      localOnly        INTEGER DEFAULT 0,
      cachedAt         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY);


    CREATE TABLE IF NOT EXISTS feed_posts (
      id            TEXT PRIMARY KEY,
      authorId      TEXT,
      screenname    TEXT,
      content       TEXT,
      mediaUrl      TEXT,
      isAwayMessage INTEGER DEFAULT 0,
      privacy       TEXT,
      nudgeCount    INTEGER DEFAULT 0,
      createdAt     TEXT,
      cachedAt      TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_channel
      ON channel_messages(channelId, createdAt);

    CREATE INDEX IF NOT EXISTS idx_feed
      ON feed_posts(createdAt);
  `);

  // ---------------------------------------------------------------------------
  // Column migrations — ALTER TABLE does not support IF NOT EXISTS in SQLite,
  // so we track applied migrations in the _migrations table.
  // ---------------------------------------------------------------------------

  const hasMigration = db
    .prepare("SELECT 1 FROM _migrations WHERE name = ?")
    .get("add_gif_columns");

  if (!hasMigration) {
    db.exec(`
      ALTER TABLE channel_messages ADD COLUMN gifUrl  TEXT;
      ALTER TABLE channel_messages ADD COLUMN gifTitle TEXT;
    `);
    db.prepare("INSERT INTO _migrations VALUES (?)").run("add_gif_columns");
  }

  return db;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function getMessages(channelId: string, limit = 100): LocalMessage[] {
  if (!db) throw new Error("DB not initialized");

  return (
    db
      .prepare(
        `SELECT * FROM channel_messages
         WHERE channelId = ?
         ORDER BY createdAt DESC
         LIMIT ?`
      )
      .all(channelId, limit) as Record<string, unknown>[]
  ).map((row) => ({
    ...(row as Omit<LocalMessage, "isThread" | "localOnly">),
    isThread:  row["isThread"]  === 1,
    localOnly: row["localOnly"] === 1,
  }));
}

export function saveMessage(message: LocalMessage): void {
  if (!db) throw new Error("DB not initialized");

  db.prepare(
    `INSERT OR REPLACE INTO channel_messages (
       id, channelId, senderId, screenname,
       encryptedContent, decryptedContent, iv,
       gifUrl, gifTitle,
       createdAt, isThread, parentMessageId, localOnly, cachedAt
     ) VALUES (
       @id, @channelId, @senderId, @screenname,
       @encryptedContent, @decryptedContent, @iv,
       @gifUrl, @gifTitle,
       @createdAt, @isThread, @parentMessageId, @localOnly, @cachedAt
     )`
  ).run({
    ...message,
    encryptedContent: message.encryptedContent ?? null,
    decryptedContent: message.decryptedContent ?? null,
    iv:               message.iv               ?? null,
    gifUrl:           message.gifUrl            ?? null,
    gifTitle:         message.gifTitle          ?? null,
    parentMessageId:  message.parentMessageId  ?? null,
    isThread:         message.isThread  ? 1 : 0,
    localOnly:        message.localOnly ? 1 : 0,
  });
}

export function getFeedPosts(limit = 50): LocalPost[] {
  if (!db) throw new Error("DB not initialized");

  return (
    db
      .prepare(
        `SELECT * FROM feed_posts
         ORDER BY createdAt DESC
         LIMIT ?`
      )
      .all(limit) as Record<string, unknown>[]
  ).map((row) => ({
    ...(row as Omit<LocalPost, "isAwayMessage">),
    isAwayMessage: row["isAwayMessage"] === 1,
  }));
}

export function saveFeedPost(post: LocalPost): void {
  if (!db) throw new Error("DB not initialized");

  db.prepare(
    `INSERT OR REPLACE INTO feed_posts (
       id, authorId, screenname, content, mediaUrl,
       isAwayMessage, privacy, nudgeCount, createdAt, cachedAt
     ) VALUES (
       @id, @authorId, @screenname, @content, @mediaUrl,
       @isAwayMessage, @privacy, @nudgeCount, @createdAt, @cachedAt
     )`
  ).run({
    ...post,
    authorId:     post.authorId   ?? null,
    screenname:   post.screenname ?? null,
    content:      post.content    ?? null,
    mediaUrl:     post.mediaUrl   ?? null,
    privacy:      post.privacy    ?? null,
    createdAt:    post.createdAt  ?? null,
    isAwayMessage: post.isAwayMessage ? 1 : 0,
  });
}

export function clearChannel(channelId: string): void {
  if (!db) throw new Error("DB not initialized");
  db.prepare("DELETE FROM channel_messages WHERE channelId = ?").run(channelId);
}

/** Called on account deletion — wipes everything. */
export function clearAllData(): void {
  if (!db) throw new Error("DB not initialized");
  db.prepare("DELETE FROM channel_messages").run();
  db.prepare("DELETE FROM feed_posts").run();
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
