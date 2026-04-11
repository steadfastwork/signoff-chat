"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { ProfileCard, type ProfileData } from "@/components/ProfileCard";
import { MutualChannels } from "@/components/MutualChannels";
import { ProfileBoards } from "@/components/ProfileBoards";
import { StatusDot } from "@/components/StatusDot";
import { RichTextContent } from "@/components/RichTextContent";
import { formatTimestamp } from "@/lib/utils";
import { CurrentlyEditor } from "@/components/currently/CurrentlyEditor";
import { type CurrentlyData } from "@/lib/currently";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PostItem {
  id: string;
  content: string;
  privacy: "PUBLIC" | "BUDDIES_ONLY";
  mediaUrl: string | null;
  mediaType: "IMAGE" | "VIDEO" | "GIF" | null;
  mediaUrls?: string[];
  gifUrls?: string[];
  createdAt: string;
  _count: { nudges: number; replies: number };
}

interface ProfileResponse extends ProfileData {
  posts: PostItem[];
  mutualChannels: { name: string; type: string }[];
  publicBoards: { name: string; displayName: string }[];
  feedVisibility: "PUBLIC" | "BUDDIES" | "PRIVATE";
  postsLocked: boolean;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: "#1a1a12", background: "#0a0a08" }}
      >
        <div className="flex gap-4">
          <div className="w-14 h-14 rounded-xl" style={{ background: "#1a1a12" }} />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 rounded w-32" style={{ background: "#1a1a12" }} />
            <div className="h-3 rounded w-48" style={{ background: "#161610" }} />
            <div className="h-3 rounded w-24" style={{ background: "#161610" }} />
          </div>
        </div>
      </div>
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border p-4"
          style={{ borderColor: "#1a1a12" }}
        >
          <div className="h-3 rounded w-3/4 mb-2" style={{ background: "#161610" }} />
          <div className="h-3 rounded w-1/2" style={{ background: "#161610" }} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post row
// ---------------------------------------------------------------------------

function PostRow({
  post,
  isSelf,
}: {
  post: PostItem;
  isSelf: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-4 transition-colors"
      style={{ borderColor: "#1a1a12", background: "#0a0a08" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-sm leading-relaxed break-words flex-1" style={{ fontFamily: "var(--font-dm-sans)", color: "var(--text-muted)" }}>
          <RichTextContent html={post.content} />
        </div>
        {isSelf && post.privacy === "BUDDIES_ONLY" && (
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
            style={{
              background: "rgba(200,134,10,0.08)",
              color: "#c8860a",
              border: "1px solid rgba(200,134,10,0.2)",
            }}
          >
            buddies only
          </span>
        )}
      </div>

      {/* New array media */}
      {((post.mediaUrls?.length ?? 0) > 0 || (post.gifUrls?.length ?? 0) > 0) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {(post.mediaUrls ?? []).map((url, i) => (
            <div key={`m-${i}`} className="rounded-[10px] overflow-hidden max-w-xs">
              {url.match(/\.(mp4|webm|ogg)(\?|$)/i) ? (
                <video src={url} controls className="w-full h-auto rounded-[10px]" />
              ) : (
                <Image src={url} alt="" width={400} height={300} className="w-full h-auto" unoptimized />
              )}
            </div>
          ))}
          {(post.gifUrls ?? []).map((url, i) => (
            <div key={`g-${i}`} className="rounded-[10px] overflow-hidden max-w-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="gif" className="w-full h-auto rounded-[10px]" loading="lazy" />
            </div>
          ))}
        </div>
      )}

      {/* Legacy single-media fallback */}
      {!(post.mediaUrls?.length) && !(post.gifUrls?.length) && post.mediaUrl && post.mediaType === "IMAGE" && (
        <div className="rounded-[10px] overflow-hidden mb-3">
          <Image src={post.mediaUrl} alt="" width={600} height={400} className="w-full h-auto" unoptimized />
        </div>
      )}
      {!(post.mediaUrls?.length) && !(post.gifUrls?.length) && post.mediaUrl && post.mediaType === "VIDEO" && (
        <video src={post.mediaUrl} controls className="rounded-[10px] w-full mb-3" />
      )}

      <div className="flex items-center gap-3">
        <span className="text-[11px] font-mono" style={{ color: "#2a2a1a" }}>
          {formatTimestamp(post.createdAt)}
        </span>
        <span className="text-[11px] font-mono" style={{ color: "#2a2a1a" }}>
          👋 {post._count.nudges}
        </span>
        <span className="text-[11px] font-mono" style={{ color: "#2a2a1a" }}>
          💬 {post._count.replies}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const screenname = params.screenname as string;

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [currentlyEditorOpen, setCurrentlyEditorOpen] = useState(false);
  const [currentlySaving, setCurrentlySaving] = useState(false);
  const [currentlyUpdated, setCurrentlyUpdated] = useState(false);
  const [boardsEnabled, setBoardsEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/feature-flags/boards")
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d: { enabled: boolean }) => setBoardsEnabled(d.enabled === true))
      .catch(() => setBoardsEnabled(false));
  }, []);

  // Redirect /u/me to own profile
  const resolvedScreenname =
    screenname === "me" ? session?.user?.screenname ?? screenname : screenname;

  const fetchProfile = useCallback(async () => {
    if (screenname === "me" && !session?.user?.screenname) return;
    const res = await fetch(`/api/users/${resolvedScreenname}`);
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    if (res.ok) {
      setProfile(await res.json());
    } else {
      setNotFound(true);
    }
  }, [resolvedScreenname, session?.user?.screenname, screenname]);

  useEffect(() => {
    setLoading(true);
    fetchProfile().finally(() => setLoading(false));
  }, [fetchProfile]);

  const handleSaveCurrently = async (data: CurrentlyData) => {
    setCurrentlySaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currently: data }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile((p) => p ? { ...p, currently: updated.currently } : p);
        setCurrentlyEditorOpen(false);
        setCurrentlyUpdated(true);
        setTimeout(() => setCurrentlyUpdated(false), 2000);
      }
    } finally {
      setCurrentlySaving(false);
    }
  };

  const handleRelationshipChange = (
    relationship: ProfileData["relationship"],
    pendingDirection: "sent" | "received" | null
  ) => {
    if (!profile) return;
    if (relationship === "blocked") {
      router.push("/feed");
      return;
    }
    setProfile((p) =>
      p ? { ...p, relationship, pendingDirection } : p
    );
  };

  // ---- Not found ----
  if (notFound) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen gap-3"
        style={{ background: "#0d0d0b" }}
      >
        <p className="text-sm" style={{ color: "#6b7280", fontFamily: "var(--font-dm-sans)" }}>
          user not found.
        </p>
        <Link href="/feed" className="text-xs font-mono" style={{ color: "#c8860a" }}>
          ← back to feed
        </Link>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen profile-page"
      style={{ background: "var(--bg, #0d0d0b)", fontFamily: "var(--font-dm-sans)" }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back nav */}
        <div className="mb-5">
          <button
            onClick={() => router.back()}
            className="text-sm font-mono"
            style={{ color: "#3a3a2a" }}
          >
            ←
          </button>
        </div>

        {loading ? (
          <ProfileSkeleton />
        ) : profile ? (
          <div className="space-y-5">
            {/* Profile card */}
            <ProfileCard
              profile={profile}
              onRelationshipChange={handleRelationshipChange}
              currentlyEditorOpen={currentlyEditorOpen}
              onOpenCurrentlyEditor={() => setCurrentlyEditorOpen(true)}
            />

            {/* Currently editor — own profile only */}
            {profile.relationship === "self" && currentlyEditorOpen && (
              <div
                style={{
                  animation: "fadeIn 0.15s ease",
                }}
              >
                <CurrentlyEditor
                  initial={profile.currently ?? {}}
                  onSave={handleSaveCurrently}
                  onCancel={() => setCurrentlyEditorOpen(false)}
                  saving={currentlySaving}
                />
              </div>
            )}

            {currentlyUpdated && (
              <p
                className="text-[11px] font-mono text-center"
                style={{ color: "var(--text-dim)", animation: "fadeIn 0.2s ease" }}
              >
                currently updated.
              </p>
            )}

            {/* Channels + boards row */}
            {(profile.mutualChannels.length > 0 || (boardsEnabled && profile.publicBoards.length > 0)) && (
              <div
                className="rounded-2xl border p-4 flex flex-col gap-4"
                style={{ borderColor: "#1a1a12", background: "#0a0a08" }}
              >
                <MutualChannels channels={profile.mutualChannels} />
                {boardsEnabled && <ProfileBoards boards={profile.publicBoards} />}
              </div>
            )}

            {/* Posts */}
            {profile.postsLocked ? (
              <div
                className="rounded-2xl border p-6 text-center"
                style={{ borderColor: "#1a1a12", background: "#0a0a08" }}
              >
                <span className="text-2xl mb-2 block">🔒</span>
                <p className="text-sm font-semibold mb-1" style={{ color: "#e5e7eb", fontFamily: "var(--font-dm-sans)" }}>
                  {profile.feedVisibility === "PRIVATE"
                    ? "posts are private"
                    : "buddies only"}
                </p>
                <p className="text-xs" style={{ color: "#3a3a2a", fontFamily: "var(--font-dm-sans)" }}>
                  {profile.feedVisibility === "PRIVATE"
                    ? `${profile.screenname} has set their posts to private.`
                    : `add ${profile.screenname} as a buddy to see their posts.`}
                </p>
              </div>
            ) : (
              <>
                {profile.posts.length > 0 && (
                  <section>
                    <h2
                      className="text-[10px] font-mono uppercase tracking-widest mb-3"
                      style={{ color: "#3a3a2a" }}
                    >
                      posts
                    </h2>
                    <div className="flex flex-col gap-3">
                      {profile.posts.map((post) => (
                        <PostRow
                          key={post.id}
                          post={post}
                          isSelf={profile.relationship === "self"}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {profile.posts.length === 0 && (
                  <p
                    className="text-sm italic py-4 text-center"
                    style={{ color: "#2a2a1a" }}
                  >
                    no posts yet.
                  </p>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
