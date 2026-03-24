"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Profile {
  id: string;
  screenname: string;
  email: string;
  bio: string | null;
  awayMessage: string | null;
  status: string;
  isGoldMember: boolean;
  profileTheme: string | null;
  createdAt: string;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [awayMessage, setAwayMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!session) { router.push("/login"); return; }
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data: Profile) => {
        setProfile(data);
        setBio(data.bio ?? "");
        setAwayMessage(data.awayMessage ?? "");
      });
  }, [session, router]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio, awayMessage }),
    });
    const updated = await res.json();
    setProfile(updated);
    setEditing(false);
    setSaving(false);
    setSaved(true);
  };

  if (!profile) {
    return <div className="max-w-xl mx-auto p-8 font-mono text-green-800 animate-pulse">loading...</div>;
  }

  return (
    <div className="max-w-xl mx-auto p-4 font-mono">
      <div className="border border-green-950 bg-black">
        <div className="border-b border-green-950 p-4">
          <h1 className="font-vt323 text-2xl text-green-400">{"// MY PROFILE"}</h1>
        </div>
        <div className="p-6 flex flex-col gap-5">
          <div>
            <p className="text-green-700 text-xs uppercase tracking-wider mb-1">screenname</p>
            <p className="text-green-300 text-sm">
              {profile.screenname}
              {profile.isGoldMember && <span className="ml-1" style={{ color: "#d4a017" }}>★ gold member</span>}
            </p>
          </div>
          <div>
            <p className="text-green-700 text-xs uppercase tracking-wider mb-1">bio <span className="text-green-900 normal-case">(160 chars)</span></p>
            {editing ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                rows={3}
                className="w-full bg-transparent border border-green-900 focus:border-green-600 outline-none text-green-200 text-sm px-2 py-1 resize-none"
              />
            ) : (
              <p className="text-green-400 text-sm italic">{profile.bio || "not set"}</p>
            )}
          </div>
          <div>
            <p className="text-green-700 text-xs uppercase tracking-wider mb-1">away message <span className="text-green-900 normal-case">(140 chars)</span></p>
            {editing ? (
              <input
                value={awayMessage}
                onChange={(e) => setAwayMessage(e.target.value)}
                maxLength={140}
                className="w-full bg-transparent border border-green-900 focus:border-green-600 outline-none text-green-200 text-sm px-2 py-1"
              />
            ) : (
              <p className="text-green-400 text-sm italic">{profile.awayMessage || "not set"}</p>
            )}
          </div>

          {saved && <p className="text-green-500 text-xs">saved.</p>}

          <div className="flex gap-3">
            {editing ? (
              <>
                <button onClick={handleSave} disabled={saving} className="border border-green-700 hover:border-green-500 text-green-400 px-4 py-1.5 text-sm disabled:opacity-40">
                  {saving ? "[saving...]" : "[save]"}
                </button>
                <button onClick={() => setEditing(false)} className="border border-green-950 text-green-700 hover:text-green-500 px-4 py-1.5 text-sm">
                  [cancel]
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="border border-green-900 hover:border-green-700 text-green-700 hover:text-green-400 px-4 py-1.5 text-sm transition-colors">
                [edit profile]
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
