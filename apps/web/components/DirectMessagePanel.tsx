"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useUploadThing } from "@/lib/uploadthing";
import { GiphyPicker, type GifResult } from "@/components/composer/GiphyPicker";
import { MediaAttachments, type PendingMedia } from "@/components/composer/MediaAttachments";
import { pusherClient, CHANNELS } from "@/lib/pusher";
import { formatTimestamp } from "@/lib/utils";
import { playSound, unlockSounds } from "@/lib/sounds";
import {
  generateSessionKey,
  encryptSessionKeyForMember,
  decryptSessionKey,
  encryptWithSessionKey,
  decryptWithSessionKey,
  fromBase64,
  toBase64,
} from "@/lib/crypto/index";
import { getCachedSecretKey } from "@/lib/crypto/localKey";
import { cacheSessionKey, getCachedSessionKey } from "@/lib/crypto/channelKeyCache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageSender {
  id: string;
  screenname: string;
  isGoldMember: boolean;
}

interface DMMessage {
  id: string;
  content: string;
  mediaUrl?: string | null;
  mediaType?: "IMAGE" | "VIDEO" | "GIF" | null;
  isEncrypted?: boolean;
  encryptedContent?: string | null;
  iv?: string | null;
  keyVersion?: number | null;
  createdAt: string;
  author: MessageSender;
}

interface DMUser {
  id: string;
  screenname: string;
  isGoldMember: boolean;
}

interface ActiveKey {
  channelId: string;
  keyVersion: number;
  myEncryptedKey: string;
}

// ---------------------------------------------------------------------------
// Decryption helper
// ---------------------------------------------------------------------------

function decryptDMMessage(
  msg: DMMessage,
  channelId: string,
  secretKey: Uint8Array
): string {
  if (
    !msg.isEncrypted ||
    !msg.encryptedContent ||
    !msg.iv ||
    msg.keyVersion == null
  ) {
    return msg.content;
  }

  const sessionKey = getCachedSessionKey(channelId, msg.keyVersion);
  if (!sessionKey) return "🔒 [key not available — unlock on another device]";

  try {
    return decryptWithSessionKey(
      fromBase64(msg.encryptedContent),
      fromBase64(msg.iv),
      sessionKey
    );
  } catch {
    return "🔒 [decryption failed]";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DirectMessagePanel({ otherUser }: { otherUser: DMUser }) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [displayMessages, setDisplayMessages] = useState<
    Array<DMMessage & { displayContent: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Media upload
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [pendingGifs, setPendingGifs]   = useState<GifResult[]>([]);
  const [showGiphy, setShowGiphy]       = useState(false);
  const dmFileInputRef = useRef<HTMLInputElement>(null);
  const { startUpload: startDMUpload, isUploading: isDMUploading } = useUploadThing("channelMedia", {
    onClientUploadComplete: (res) => {
      const newMedia: PendingMedia[] = res.map((f) => ({
        url: f.url,
        type: f.type?.startsWith("video/") ? "VIDEO" : "IMAGE",
      }));
      setPendingMedia((prev) => [...prev, ...newMedia]);
    },
    onUploadError: () => {},
  });

  // Encryption state
  const channelIdRef = useRef<string | null>(null);
  const activeKeyRef = useRef<ActiveKey | null>(null);
  const peerPublicKeyRef = useRef<string | null>(null);
  const myPublicKeyRef = useRef<string | null>(null);
  const encryptionReadyRef = useRef(false);

  // Load messages and key info
  useEffect(() => {
    localStorage.setItem(`dm_last_read_${otherUser.id}`, new Date().toISOString());

    Promise.all([
      fetch(`/api/messages/${otherUser.id}`).then((r) => r.json()),
      fetch(`/api/messages/${otherUser.id}/key`).then((r) => r.json()),
    ])
      .then(([msgData, keyData]) => {
        const msgs: DMMessage[] = Array.isArray(msgData.messages)
          ? msgData.messages
          : [];
        setMessages(msgs);

        peerPublicKeyRef.current = keyData.peerPublicKey ?? null;
        myPublicKeyRef.current = keyData.myPublicKey ?? null;

        if (keyData.key) {
          activeKeyRef.current = keyData.key;
          channelIdRef.current = keyData.key.channelId;
        }

        // Decrypt session key if we have it
        if (session?.user?.id) {
          const sk = getCachedSecretKey(session.user.id);
          if (sk && keyData.key) {
            try {
              const sessionKey = decryptSessionKey(keyData.key.myEncryptedKey, sk);
              cacheSessionKey(keyData.key.channelId, keyData.key.keyVersion, sessionKey);
              encryptionReadyRef.current = true;
            } catch {
              // Failed to decrypt session key
            }
          } else if (sk && myPublicKeyRef.current && peerPublicKeyRef.current) {
            encryptionReadyRef.current = true; // Can create new key
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUser.id]);

  // Decrypt messages for display whenever messages or session key cache changes
  useEffect(() => {
    if (!session?.user?.id) {
      setDisplayMessages(messages.map((m) => ({ ...m, displayContent: m.content })));
      return;
    }
    const channelId = channelIdRef.current;
    const sk = getCachedSecretKey(session.user.id);

    setDisplayMessages(
      messages.map((m) => ({
        ...m,
        displayContent: channelId && sk
          ? decryptDMMessage(m, channelId, sk)
          : m.isEncrypted
          ? "🔒 [unlock encryption to read]"
          : m.content,
      }))
    );
  }, [messages, session?.user?.id]);

  // Pusher subscription
  useEffect(() => {
    if (!session?.user?.id) return;
    const ch = pusherClient.subscribe(CHANNELS.dm(session.user.id, otherUser.id));
    ch.bind("new-dm", (msg: DMMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        if (msg.author.id !== session?.user?.id) playSound("message_received");
        return [...prev, msg];
      });
      localStorage.setItem(`dm_last_read_${otherUser.id}`, new Date().toISOString());
    });
    return () => pusherClient.unsubscribe(CHANNELS.dm(session.user.id, otherUser.id));
  }, [session?.user?.id, otherUser.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  // ---------------------------------------------------------------------------
  // Send
  // ---------------------------------------------------------------------------

  const handleSend = useCallback(
    async () => {
      const hasMedia = pendingMedia.length > 0 || pendingGifs.length > 0;
      if ((!input && !hasMedia) || sending || !session) return;
      unlockSounds();
      const content = input;
      setSending(true);
      setInput("");

      const userId = session.user.id;
      const sk = getCachedSecretKey(userId);

      // Optimistic update (always show plaintext locally while sending)
      const tempId = `temp-${Date.now()}`;
      const optimistic: DMMessage = {
        id: tempId,
        content,
        createdAt: new Date().toISOString(),
        author: {
          id: userId,
          screenname: session.user.screenname,
          isGoldMember: session.user.isGoldMember ?? false,
        },
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        let body: Record<string, unknown>;

        if (
          sk &&
          myPublicKeyRef.current &&
          peerPublicKeyRef.current &&
          encryptionReadyRef.current
        ) {
          // Ensure we have an active session key
          let channelId = channelIdRef.current;
          let activeKey = activeKeyRef.current;

          if (!activeKey || !channelId) {
            // Create new session key for this DM
            const sessionKey = generateSessionKey();
            const encryptedKeys: Record<string, string> = {
              [userId]: encryptSessionKeyForMember(sessionKey, fromBase64(myPublicKeyRef.current!)),
              [otherUser.id]: encryptSessionKeyForMember(sessionKey, fromBase64(peerPublicKeyRef.current!)),
            };
            const res = await fetch(`/api/messages/${otherUser.id}/key`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ encryptedKeys }),
            });
            if (res.ok) {
              const data = await res.json();
              channelId = data.channelId;
              const kv = data.keyVersion as number;
              channelIdRef.current = channelId;
              activeKey = {
                channelId: channelId!,
                keyVersion: kv,
                myEncryptedKey: encryptedKeys[userId],
              };
              activeKeyRef.current = activeKey;
              cacheSessionKey(channelId!, kv, sessionKey);
            }
          }

          if (channelId && activeKey) {
            const sessionKey = getCachedSessionKey(channelId, activeKey.keyVersion);
            if (sessionKey) {
              const { ciphertext, iv } = encryptWithSessionKey(content, sessionKey);
              body = {
                isEncrypted: true,
                encryptedContent: toBase64(ciphertext),
                iv: toBase64(iv),
                keyVersion: activeKey.keyVersion,
              };
            } else {
              body = { content };
            }
          } else {
            body = { content };
          }
        } else {
          body = { content };
        }

        const res = await fetch(`/api/messages/${otherUser.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const saved: DMMessage = await res.json();
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? saved : m))
          );
          playSound("message_sent");
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
        }

        // Send media as separate messages (DM API supports mediaUrl via ChannelMessage)
        for (const media of pendingMedia) {
          await fetch(`/api/messages/${otherUser.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "", mediaUrl: media.url, mediaType: media.type }),
          });
        }
        for (const gif of pendingGifs) {
          await fetch(`/api/messages/${otherUser.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: gif.title || "GIF", mediaUrl: gif.url, mediaType: "GIF" }),
          });
        }
        setPendingMedia([]);
        setPendingGifs([]);
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      } finally {
        setSending(false);
        // focus is handled by RichTextEditor autoFocus on next render
      }
    },
    [input, sending, session, otherUser.id, pendingMedia, pendingGifs]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const encryptionActive =
    encryptionReadyRef.current && !!channelIdRef.current;

  return (
    <div
      className="flex flex-col h-full"
      style={{ fontFamily: "var(--font-dm-sans)", background: "var(--bg)" }}
    >
      {/* Header */}
      <div
        className="border-b px-4 py-3 flex-shrink-0 flex items-center justify-between"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            {otherUser.screenname}
            {otherUser.isGoldMember && (
              <span className="ml-1 text-xs" style={{ color: "#d4a017" }}>★</span>
            )}
          </p>
          <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--text-dim)" }}>
            {encryptionActive ? "🔒 end-to-end encrypted" : "direct message"}
          </p>
        </div>
        <Link
          href={`/u/${otherUser.screenname}`}
          className="text-[11px] font-mono px-2 py-1 rounded-lg border transition-all"
          style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--teal)";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--teal)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)";
          }}
        >
          view profile
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {loading && (
          <p
            className="text-sm text-center animate-pulse mt-4"
            style={{ color: "var(--text-dim)" }}
          >
            loading…
          </p>
        )}
        {!loading && displayMessages.length === 0 && (
          <p
            className="text-sm text-center mt-4 font-mono"
            style={{ color: "var(--text-dim)" }}
          >
            no messages yet. say hi!
          </p>
        )}
        {displayMessages.map((msg) => {
          const isMe = msg.author.id === session?.user?.id;
          const isOptimistic = msg.id.startsWith("temp-");
          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}
            >
              {!isMe && (
                <span
                  className="text-[10px] font-mono px-1"
                  style={{ color: "var(--text-dim)" }}
                >
                  {msg.author.screenname}
                </span>
              )}
              <div
                className="max-w-[75%] rounded-xl text-sm overflow-hidden"
                style={
                  isMe
                    ? {
                        background: msg.mediaUrl && !msg.displayContent ? "transparent" : "var(--teal)",
                        color: "var(--bg)",
                        opacity: isOptimistic ? 0.6 : 1,
                      }
                    : {
                        background: msg.mediaUrl && !msg.displayContent ? "transparent" : "var(--surface)",
                        color: "var(--text)",
                        border: msg.mediaUrl && !msg.displayContent ? "none" : "1px solid var(--border)",
                      }
                }
              >
                {msg.displayContent && (
                  <div className="px-3 py-2">{msg.displayContent}</div>
                )}
                {msg.mediaUrl && (msg.mediaType === "IMAGE" || msg.mediaType === "GIF") && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={msg.mediaUrl}
                    alt="attachment"
                    className="rounded-xl max-w-[240px] max-h-[200px] object-cover cursor-pointer block"
                    onClick={() => window.open(msg.mediaUrl!, "_blank")}
                  />
                )}
                {msg.mediaUrl && msg.mediaType === "VIDEO" && (
                  <video src={msg.mediaUrl} controls className="rounded-xl max-w-[240px] block" />
                )}
              </div>
              <span
                className="text-[10px] font-mono px-1"
                style={{ color: "var(--text-dim)" }}
              >
                {formatTimestamp(msg.createdAt)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {session && (
        <div
          className="border-t px-3 py-2 flex-shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          {/* Media preview */}
          {(pendingMedia.length > 0 || pendingGifs.length > 0) && (
            <div className="mb-2">
              <MediaAttachments
                media={pendingMedia}
                gifs={pendingGifs}
                onRemoveMedia={(i) => setPendingMedia((prev) => prev.filter((_, idx) => idx !== i))}
                onRemoveGif={(i) => setPendingGifs((prev) => prev.filter((_, idx) => idx !== i))}
              />
            </div>
          )}
          {showGiphy && (
            <div className="mb-2">
              <GiphyPicker
                onSelect={(gif) => { setPendingGifs((prev) => [...prev, gif]); setShowGiphy(false); }}
                onClose={() => setShowGiphy(false)}
              />
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1 rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <RichTextEditor
                value={input}
                onChange={setInput}
                placeholder={`message ${otherUser.screenname}…`}
                variant="compact"
                onSubmit={handleSend}
                disabled={sending || isDMUploading}
                onPhotoClick={() => dmFileInputRef.current?.click()}
                onGifClick={() => setShowGiphy((v) => !v)}
              />
              <input
                ref={dmFileInputRef}
                type="file"
                accept="image/*,video/*"
                className="sr-only"
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files?.length) return;
                  await startDMUpload(Array.from(files));
                  e.target.value = "";
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={(!input && pendingMedia.length === 0 && pendingGifs.length === 0) || sending || isDMUploading}
              className="text-xs font-mono px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 flex-shrink-0"
              style={{
                background: "var(--teal)",
                color: "var(--bg)",
                fontWeight: 600,
              }}
            >
              {isDMUploading ? "uploading…" : "send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
