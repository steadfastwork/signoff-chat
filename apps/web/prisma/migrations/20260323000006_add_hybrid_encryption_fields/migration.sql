-- =============================================================================
-- Migration: add-hybrid-encryption-fields
-- Adds ML-KEM-1024 + AES-256-GCM hybrid encryption fields to the schema.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- User: ML-KEM public key + backup confirmation flag
-- ---------------------------------------------------------------------------
ALTER TABLE "users" ADD COLUMN "mlkemPublicKey"      TEXT;
ALTER TABLE "users" ADD COLUMN "hasConfirmedBackup"  BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- ChannelMessage: per-message encryption fields
-- When isEncrypted=true, clients read encryptedContent; content holds a stub.
-- ---------------------------------------------------------------------------
ALTER TABLE "room_messages" ADD COLUMN "isEncrypted"      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "room_messages" ADD COLUMN "encryptedContent" TEXT;
ALTER TABLE "room_messages" ADD COLUMN "encapsulatedKey"  TEXT;
ALTER TABLE "room_messages" ADD COLUMN "iv"               TEXT;
ALTER TABLE "room_messages" ADD COLUMN "keyVersion"       INTEGER;

-- ---------------------------------------------------------------------------
-- BoardPost: per-post body encryption (INVITE_ONLY + SECRET boards)
-- ---------------------------------------------------------------------------
ALTER TABLE "board_posts" ADD COLUMN "isEncrypted"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "board_posts" ADD COLUMN "encryptedBody"   TEXT;
ALTER TABLE "board_posts" ADD COLUMN "encapsulatedKey" TEXT;
ALTER TABLE "board_posts" ADD COLUMN "iv"              TEXT;

-- ---------------------------------------------------------------------------
-- ChannelKey: group session keys (one epoch per row)
-- encryptedKeys is a JSONB map: { userId: base64_packed_blob }
-- Each packed blob: ML-KEM cipherText (1568 B) || iv (12 B) || wrappedKey (48 B)
-- ---------------------------------------------------------------------------
CREATE TABLE "channel_keys" (
    "id"            TEXT        NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"     TIMESTAMP(3) NOT NULL,
    "channelId"     TEXT        NOT NULL,
    "encryptedKeys" JSONB       NOT NULL,
    "keyVersion"    INTEGER     NOT NULL,
    CONSTRAINT "channel_keys_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "channel_keys"
    ADD CONSTRAINT "channel_keys_channelId_fkey"
    FOREIGN KEY ("channelId")
    REFERENCES "rooms"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Index for efficient epoch lookup per channel
CREATE INDEX "channel_keys_channelId_keyVersion_idx" ON "channel_keys"("channelId", "keyVersion");
CREATE INDEX "channel_keys_expiresAt_idx"             ON "channel_keys"("expiresAt");
