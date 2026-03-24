import type {
  User,
  PublicUser,
  Post,
  Reply,
  BuddyRelation,
  Channel,
  ChannelMessage,
  Board,
  BoardPost,
  BoardComment,
  InviteLink,
  Tip,
  PostPrivacy,
  ChannelType,
  BoardType,
} from "@signoff/types";

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

export interface ApiClientOptions {
  /** Relative for web (""), absolute for mobile ("https://signoff.chat") */
  baseUrl?: string;
  /** Returns auth token for the Authorization header (mobile use) */
  getToken?: () => Promise<string | null> | string | null;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  url: string,
  options: RequestInit,
  getToken?: ApiClientOptions["getToken"]
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (getToken) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.code ?? "UNKNOWN",
      body.error ?? res.statusText
    );
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

export function createApiClient({ baseUrl = "", getToken }: ApiClientOptions = {}) {
  const url = (path: string) => `${baseUrl}${path}`;
  const get = <T>(path: string) => request<T>(url(path), { method: "GET" }, getToken);
  const post = <T>(path: string, body?: unknown) =>
    request<T>(url(path), { method: "POST", body: body ? JSON.stringify(body) : undefined }, getToken);
  const del = <T>(path: string) => request<T>(url(path), { method: "DELETE" }, getToken);
  const patch = <T>(path: string, body?: unknown) =>
    request<T>(url(path), { method: "PATCH", body: body ? JSON.stringify(body) : undefined }, getToken);

  return {
    // -------------------------------------------------------------------------
    // Auth
    // -------------------------------------------------------------------------
    auth: {
      register: (data: { screenname: string; email: string; password: string }) =>
        post<{ user: User }>("/api/auth/register", data),

      login: (data: { screenname: string; password: string }) =>
        post<{ token?: string }>("/api/auth/callback/credentials", data),

      logout: () => post<void>("/api/auth/signout"),
    },

    // -------------------------------------------------------------------------
    // Posts
    // -------------------------------------------------------------------------
    posts: {
      getFeed: (cursor?: string) =>
        get<{ posts: Post[]; nextCursor: string | null }>(
          `/api/posts${cursor ? `?cursor=${cursor}` : ""}`
        ),

      create: (data: { content: string; privacy: PostPrivacy; mediaUrl?: string }) =>
        post<{ post: Post }>("/api/posts", data),

      delete: (postId: string) =>
        del<void>(`/api/posts/${postId}`),

      nudge: (postId: string) =>
        post<{ nudged: boolean }>(`/api/posts/${postId}/nudge`),

      getReplies: (postId: string) =>
        get<{ replies: Reply[] }>(`/api/posts/${postId}/replies`),

      createReply: (postId: string, content: string) =>
        post<{ reply: Reply }>(`/api/posts/${postId}/replies`, { content }),
    },

    // -------------------------------------------------------------------------
    // Buddies
    // -------------------------------------------------------------------------
    buddies: {
      getList: () =>
        get<{ buddies: BuddyRelation[]; requests: BuddyRelation[] }>("/api/buddies"),

      sendRequest: (addresseeId: string) =>
        post<{ relation: BuddyRelation }>("/api/buddies/request", { addresseeId }),

      accept: (relationId: string) =>
        patch<{ relation: BuddyRelation }>(`/api/buddies/${relationId}/accept`),

      decline: (relationId: string) =>
        del<void>(`/api/buddies/${relationId}`),

      remove: (relationId: string) =>
        del<void>(`/api/buddies/${relationId}`),
    },

    // -------------------------------------------------------------------------
    // Users
    // -------------------------------------------------------------------------
    users: {
      getProfile: (screenname: string) =>
        get<{ user: PublicUser }>(`/api/users/${screenname}`),

      search: (query: string) =>
        get<{ users: PublicUser[] }>(`/api/users/search?q=${encodeURIComponent(query)}`),

      updateProfile: (data: Partial<Pick<User, "bio" | "awayMessage" | "profileTheme">>) =>
        patch<{ user: User }>("/api/users/me", data),
    },

    // -------------------------------------------------------------------------
    // Channels
    // -------------------------------------------------------------------------
    channels: {
      getList: () =>
        get<{ channels: Channel[] }>("/api/channels"),

      getChannel: (name: string) =>
        get<{ channel: Channel }>(`/api/channels/${name}`),

      create: (data: { name: string; description?: string; type: ChannelType }) =>
        post<{ channel: Channel }>("/api/channels", data),

      join: (name: string) =>
        post<{ member: object }>(`/api/channels/${name}/join`),

      leave: (name: string) =>
        del<void>(`/api/channels/${name}/leave`),

      getMessages: (name: string, cursor?: string) =>
        get<{ messages: ChannelMessage[]; nextCursor: string | null }>(
          `/api/channels/${name}/messages${cursor ? `?cursor=${cursor}` : ""}`
        ),

      sendMessage: (name: string, data: { content: string; mediaUrl?: string }) =>
        post<{ message: ChannelMessage }>(`/api/channels/${name}/messages`, data),

      createInvite: (name: string, maxUses?: number) =>
        post<{ invite: InviteLink }>(`/api/channels/${name}/invite`, { maxUses }),

      useInvite: (token: string) =>
        post<{ channelName: string }>(`/api/invites/${token}/use`),
    },

    // -------------------------------------------------------------------------
    // Boards
    // -------------------------------------------------------------------------
    boards: {
      getList: () =>
        get<{ boards: Board[] }>("/api/boards"),

      getBoard: (name: string) =>
        get<{ board: Board }>(`/api/boards/${name}`),

      create: (data: { name: string; displayName: string; vibeStatement: string; type: BoardType }) =>
        post<{ board: Board }>("/api/boards", data),

      join: (name: string) =>
        post<{ member: object }>(`/api/boards/${name}/join`),

      leave: (name: string) =>
        del<void>(`/api/boards/${name}/leave`),

      getPosts: (name: string, cursor?: string) =>
        get<{ posts: BoardPost[]; nextCursor: string | null }>(
          `/api/boards/${name}/posts${cursor ? `?cursor=${cursor}` : ""}`
        ),

      createPost: (name: string, data: { title: string; body?: string; tag?: string; mediaUrl?: string }) =>
        post<{ post: BoardPost }>(`/api/boards/${name}/posts`, data),

      getPost: (postId: string) =>
        get<{ post: BoardPost }>(`/api/boards/posts/${postId}`),

      nudgePost: (postId: string) =>
        post<{ nudged: boolean }>(`/api/boards/posts/${postId}/nudge`),

      getComments: (postId: string) =>
        get<{ comments: BoardComment[] }>(`/api/boards/posts/${postId}/comments`),

      createComment: (postId: string, data: { body: string; parentCommentId?: string }) =>
        post<{ comment: BoardComment }>(`/api/boards/posts/${postId}/comments`, data),

      nudgeComment: (commentId: string) =>
        post<{ nudged: boolean }>(`/api/boards/comments/${commentId}/nudge`),

      createInvite: (name: string, maxUses?: number) =>
        post<{ invite: InviteLink }>(`/api/boards/${name}/invite`, { maxUses }),
    },

    // -------------------------------------------------------------------------
    // Tips
    // -------------------------------------------------------------------------
    tips: {
      send: (data: { recipientId: string; amount: number; message?: string }) =>
        post<{ tip: Tip; clientSecret: string }>("/api/tips", data),

      getHistory: () =>
        get<{ sent: Tip[]; received: Tip[] }>("/api/tips/history"),
    },
  };
}

// Default singleton for web (uses relative URLs, relies on browser session cookie)
export const apiClient = createApiClient();

export type ApiClient = ReturnType<typeof createApiClient>;
