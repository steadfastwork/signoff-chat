import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import type { Session } from "@/lib/session";

interface Props {
  session: Session | null | undefined;
}

/**
 * Mounted at the root layout. Redirects unauthenticated users to the login
 * screen and redirects already-authed users away from auth screens.
 */
export function AuthGuard({ session }: Props) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (session === undefined) return; // still initializing

    const inAuth = segments[0] === "(auth)";

    if (!session && !inAuth) {
      router.replace("/(auth)/login");
    } else if (session && inAuth) {
      router.replace("/(app)/(tabs)/feed");
    }
  }, [session, segments, router]);

  return null;
}
