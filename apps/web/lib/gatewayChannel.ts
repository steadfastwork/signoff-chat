// Shared (server + client safe — no secrets) helper for the gateway's Pusher
// relay channel. Must match apps/gateway/src/index.ts `channelFor()`:
//   private-user-<lowercased alnum screenname>
export const normScreenname = (sn: string): string => sn.toLowerCase().replace(/[^a-z0-9]/g, "");
export const gatewayUserChannel = (sn: string): string => `private-user-${normScreenname(sn)}`;
