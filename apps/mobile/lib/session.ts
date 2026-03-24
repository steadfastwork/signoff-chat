import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "signoff_session";

export interface Session {
  token: string;
  userId: string;
  screenname: string;
  isGoldMember: boolean;
  avatarColor: string;
  expiresAt: number; // unix ms
}

export async function getSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const session: Session = JSON.parse(raw);
    if (Date.now() >= session.expiresAt) {
      await clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function setSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
