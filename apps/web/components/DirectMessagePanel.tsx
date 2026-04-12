"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useUploadThing } from "@/lib/uploadthing";
import { GiphyPicker, type GifResult } from "@/components/composer/GiphyPicker";
import { MediaAttachments, type PendingMedia } from "@/components/composer/MediaAttachments";
import { pusherClient, CHANNELS } from "@/lib/pusher";
import { playSound, unlockSounds } from "@/lib/sounds";
import { groupMessages } from "@/lib/chat";
import { FlatMessageGroup } from "@/components/chat/FlatMessageGroup";
import { TimeSeparator as TimeSeparatorComp } from "@/components/chat/TimeSeparator";
import { DMColorPickerRow } from "@/components/chat/DMColorPickerRow";
import { DM_COLOR_PALETTE, type DMColor, type DMFontSize } from "@/lib/dmColors";
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
  textColor?: string | null;
  fontSize?: string | null;
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

export function DirectMessagePanel({
  otherUser,
  initialDraft,
}: {
  otherUser: DMUser;
  initialDraft?: string;
}) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [displayMessages, setDisplayMessages] = useState<
    Array<DMMessage & { displayContent: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState(initialDraft ?? "");
  // Ref mirrors input so handleSend always reads the latest value even if
  // React hasn't flushed the state update yet (Safari mobile / IME quirk).
  const inputRef = useRef(initialDraft ?? "");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // DM font color feature
  const [dmFontColorsEnabled, setDmFontColorsEnabled] = useState(false);
  const [myColor, setMyColor] = useState<DMColor | string>("#c8860a");
  const [mySize, setMySize] = useState<DMFontSize>("md");
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);
  const saveColorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Load feature flag + user color preferences
  useEffect(() => {
    Promise.all([
      fetch("/api/feature-flags/DM_FONT_COLORS").then((r) => r.ok ? r.json() : { enabled: false }),
      fetch("/api/profile").then((r) => r.ok ? r.json() : null),
    ]).then(([flag, profile]) => {
      if (flag?.enabled) {
        setDmFontColorsEnabled(true);
        if (profile?.dmTextColor) setMyColor(profile.dmTextColor as DMColor);
        if (profile?.dmFontSize) setMySize(profile.dmFontSize as DMFontSize);
      }
    }).catch(() => {});
  }, []);

  // Load messages and key info
  useEffect(() => {
    localStorage.setItem(`dm_last_read_${otherUser.id}`, new Date().toISOString());
    fetch(`/api/messages/${otherUser.id}/read`, { method: "POST" }).catch(() => {});

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
        if (msg.author.id !== session?.user?.id) {
          playSound("message_received");
          if (typeof window !== "undefined" && window.electronAPI) {
            const preview = msg.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
            window.electronAPI.reportDM({
              fromUserId: msg.author.id,
              screenname: msg.author.screenname,
              preview,
            });
          }
        }
        return [...prev, msg];
      });
      localStorage.setItem(`dm_last_read_${otherUser.id}`, new Date().toISOString());
      fetch(`/api/messages/${otherUser.id}/read`, { method: "POST" }).catch(() => {});
    });
    return () => pusherClient.unsubscribe(CHANNELS.dm(session.user.id, otherUser.id));
  }, [session?.user?.id, otherUser.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  // ---------------------------------------------------------------------------
  // Save color/size preferences (debounced 500ms)
  // ---------------------------------------------------------------------------

  const saveColorPref = useCallback((hex: string, size: DMFontSize) => {
    if (saveColorTimerRef.current) clearTimeout(saveColorTimerRef.current);
    saveColorTimerRef.current = setTimeout(() => {
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dmTextColor: hex, dmFontSize: size }),
      }).catch(() => {});
    }, 500);
  }, []);

  const myColorRef = useRef(myColor);
  myColorRef.current = myColor;
  const mySizeRef = useRef(mySize);
  mySizeRef.current = mySize;

  const handleColorChange = useCallback((hex: DMColor) => {
    setMyColor(hex);
    saveColorPref(hex, mySizeRef.current);
  }, [saveColorPref]);

  const handleSizeChange = useCallback((size: DMFontSize) => {
    setMySize(size);
    saveColorPref(myColorRef.current as DMColor, size);
  }, [saveColorPref]);

  // ---------------------------------------------------------------------------
  // Send
  // ---------------------------------------------------------------------------

  const handleSend = useCallback(
    async () => {
      const content = inputRef.current;
      const hasMedia = pendingMedia.length > 0 || pendingGifs.length > 0;
      if ((!content && !hasMedia) || sending || !session) return;
      unlockSounds();
      setSending(true);
      setInput("");
      inputRef.current = "";

      const userId = session.user.id;
      const sk = getCachedSecretKey(userId);

      // Optimistic update (always show plaintext locally while sending)
      const tempId = `temp-${Date.now()}`;
      const optimistic: DMMessage = {
        id: tempId,
        content,
        textColor: dmFontColorsEnabled ? myColor : null,
        fontSize: dmFontColorsEnabled ? mySize : null,
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

        // Attach color/size when flag is on
        if (dmFontColorsEnabled) {
          body = { ...body, textColor: myColor, fontSize: mySize };
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
    [sending, session, otherUser.id, pendingMedia, pendingGifs]
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
      <div className="flex-1 overflow-y-auto py-3 flex flex-col gap-0">
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
        {session?.user?.id && (() => {
          const grouped = groupMessages(
            displayMessages.map((m) => ({
              id: m.id,
              senderId: m.author.id,
              screenname: m.author.screenname,
              isGold: m.author.isGoldMember,
              content: m.displayContent,
              mediaUrl: m.mediaUrl ?? null,
              mediaType: m.mediaType ?? null,
              createdAt: m.createdAt,
              isEncrypted: m.isEncrypted,
              textColor: m.textColor ?? null,
              fontSize: m.fontSize ?? null,
            })),
            session.user.id
          );
          return grouped.map((item, i) =>
            item.type === "separator" ? (
              <TimeSeparatorComp key={`sep-${i}`} item={item} />
            ) : (
              <FlatMessageGroup
                key={item.messages[0].id}
                group={item}
                myTextColor={dmFontColorsEnabled ? myColor : undefined}
              />
            )
          );
        })()}
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
            {/* Mobile web: color dot + GIF buttons (< md) */}
            <div className="md:hidden flex items-center gap-1.5 flex-shrink-0">
              {dmFontColorsEnabled && (
                <button
                  type="button"
                  title="Text color"
                  onClick={() => setMobilePickerOpen((v) => !v)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: myColor,
                    border: "1.5px solid rgba(255,255,255,0.15)",
                    cursor: "pointer",
                    padding: 0,
                    flexShrink: 0,
                  }}
                />
              )}
              <button
                type="button"
                title="Insert GIF"
                onClick={() => setShowGiphy((v) => !v)}
                style={{
                  height: 28,
                  paddingLeft: 6,
                  paddingRight: 6,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: showGiphy ? "var(--amber-tint, rgba(200,134,10,0.12))" : "transparent",
                  color: showGiphy ? "var(--amber)" : "var(--text-dim)",
                  fontSize: 11,
                  fontFamily: "monospace",
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                GIF
              </button>
            </div>

            <div className="flex-1 rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              {/* Desktop color picker row (≥ md) */}
              {dmFontColorsEnabled && (
                <div
                  className="hidden md:block px-2 pt-1"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <DMColorPickerRow
                    color={myColor}
                    size={mySize}
                    onColorChange={handleColorChange}
                    onSizeChange={handleSizeChange}
                  />
                </div>
              )}
              <RichTextEditor
                value={input}
                onChange={(html) => { setInput(html); inputRef.current = html; }}
                placeholder={`message ${otherUser.screenname}…`}
                variant="compact"
                onSubmit={handleSend}
                disabled={sending || isDMUploading}
                onPhotoClick={() => dmFileInputRef.current?.click()}
                onGifClick={() => setShowGiphy((v) => !v)}
                textColor={dmFontColorsEnabled ? myColor : undefined}
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
              disabled={sending || isDMUploading}
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

          {/* Mobile web: color picker bottom sheet (< md) */}
          {dmFontColorsEnabled && mobilePickerOpen && (
            <div
              className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
              onClick={() => setMobilePickerOpen(false)}
            >
              <div
                className="rounded-t-2xl p-5"
                style={{ background: "#191714", borderTop: "1px solid #2c2820" }}
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-[11px] font-mono mb-3" style={{ color: "#6a6860" }}>
                  Your text color
                </p>
                <div className="flex gap-3 flex-wrap mb-4">
                  {DM_COLOR_PALETTE.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => { handleColorChange(c.hex as DMColor); }}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: c.hex,
                        border: myColor === c.hex ? "2px solid #fff" : "2px solid transparent",
                        transform: myColor === c.hex ? "scale(1.15)" : "scale(1)",
                        cursor: "pointer",
                        padding: 0,
                        transition: "transform 0.12s",
                      }}
                    />
                  ))}
                </div>
                <div className="flex gap-2 mb-4">
                  {(["sm", "md", "lg"] as DMFontSize[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSizeChange(s)}
                      style={{
                        height: 28,
                        minWidth: 36,
                        borderRadius: 6,
                        border: mySize === s ? "1px solid #8a6010" : "1px solid #2c2820",
                        background: mySize === s ? "#1a1200" : "transparent",
                        color: mySize === s ? "#c8860a" : "#6a6860",
                        fontSize: 12,
                        fontWeight: mySize === s ? 700 : 400,
                        cursor: "pointer",
                        padding: "0 10px",
                      }}
                    >
                      {s === "sm" ? "S" : s === "md" ? "M" : "L"}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setMobilePickerOpen(false)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "#c8860a", color: "#fff8e6" }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
