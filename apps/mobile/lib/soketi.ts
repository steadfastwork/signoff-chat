import PusherClient from "pusher-js";

// ---------------------------------------------------------------------------
// Soketi client — same pusher-js package, pointed at our self-hosted Soketi
// server instead of pusher.com. EXPO_PUBLIC_ vars are inlined by Metro at
// build time (analogous to NEXT_PUBLIC_ in Next.js).
// ---------------------------------------------------------------------------

export const soketiClient = new PusherClient(
  process.env.EXPO_PUBLIC_SOKETI_KEY ?? "",
  {
    wsHost: process.env.EXPO_PUBLIC_SOKETI_HOST ?? "",
    wsPort: 443,
    forceTLS: true,
    cluster: "",
    enabledTransports: ["ws", "wss"],
  }
);

// ---------------------------------------------------------------------------
// Set auth headers for private/presence channels after login.
// Call this once a session token is available.
// ---------------------------------------------------------------------------

export function setSoketiAuth(token: string): void {
  soketiClient.config.auth = {
    headers: { Authorization: `Bearer ${token}` },
  };
  soketiClient.config.authEndpoint = `${
    process.env.EXPO_PUBLIC_API_URL ?? ""
  }/api/pusher/auth`;
}
