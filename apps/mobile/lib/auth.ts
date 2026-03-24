import {
  getSession as getStoredSession,
  setSession,
  clearSession,
} from "@/lib/session";
import { setSoketiAuth } from "@/lib/soketi";
import { registerForPushNotifications } from "@/lib/notifications";

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

// ---------------------------------------------------------------------------
// login — screenname + password → stores JWT session
// ---------------------------------------------------------------------------

export async function login(
  screenname: string,
  password: string
): Promise<void> {
  const res = await fetch(`${API}/api/auth/mobile/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ screenname: screenname.trim(), password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "couldn't sign in. try again.");

  await setSession({
    token: data.token,
    userId: data.userId,
    screenname: data.screenname,
    isGoldMember: data.isGoldMember,
    avatarColor: data.avatarColor,
    expiresAt: data.expiresAt,
  });

  setSoketiAuth(data.token);

  // Register / refresh push token after every login — fire-and-forget.
  registerForPushNotifications().catch(() => {});
}

// ---------------------------------------------------------------------------
// register — creates account. does NOT log in automatically.
// caller should call login() afterwards.
// ---------------------------------------------------------------------------

export async function register(
  screenname: string,
  email: string,
  password: string
): Promise<void> {
  const res = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      screenname: screenname.trim(),
      email: email.trim().toLowerCase(),
      password,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "couldn't create account. try again.");
}

// ---------------------------------------------------------------------------
// logout — set OFFLINE on the server, then wipe local session
// ---------------------------------------------------------------------------

export async function logout(): Promise<void> {
  const session = await getStoredSession();
  if (session) {
    // Best-effort: set OFFLINE + clear push token — always proceed even if these fail
    await Promise.allSettled([
      fetch(`${API}/api/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ status: "OFFLINE" }),
      }),
      fetch(`${API}/api/user/push-token`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.token}` },
      }),
    ]);
  }
  await clearSession();
}

// ---------------------------------------------------------------------------
// getSession — returns the raw JWT token string, or null if not logged in
// ---------------------------------------------------------------------------

export async function getSession(): Promise<string | null> {
  const session = await getStoredSession();
  return session?.token ?? null;
}
