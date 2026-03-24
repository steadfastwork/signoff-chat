// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum StatusType {
  ONLINE = "ONLINE",
  AWAY = "AWAY",
  IDLE = "IDLE",
  INVISIBLE = "INVISIBLE",
  OFFLINE = "OFFLINE",
}

export enum PostPrivacy {
  PUBLIC = "PUBLIC",
  BUDDIES_ONLY = "BUDDIES_ONLY",
}

export enum BuddyStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  BLOCKED = "BLOCKED",
}

export enum ChannelType {
  PUBLIC = "PUBLIC",
  INVITE_ONLY = "INVITE_ONLY",
  SECRET = "SECRET",
}

export enum BoardType {
  PUBLIC = "PUBLIC",
  INVITE_ONLY = "INVITE_ONLY",
  SECRET = "SECRET",
}

export enum MediaType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  GIF = "GIF",
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  screenname: string;
  email: string;
  bio: string | null;
  awayMessage: string | null;
  status: StatusType;
  lastSeen: Date;
  isGoldMember: boolean;
  profileTheme: string | null;
  mlkemPublicKey: string | null;
  hasConfirmedBackup: boolean;
}

// Public-safe user shape (no email, no passwordHash)
export interface PublicUser {
  id: string;
  screenname: string;
  bio: string | null;
  awayMessage: string | null;
  status: StatusType;
  lastSeen: Date;
  isGoldMember: boolean;
  profileTheme: string | null;
  mlkemPublicKey: string | null;
}

// ---------------------------------------------------------------------------
// Post
// ---------------------------------------------------------------------------

export interface Post {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  content: string;
  authorId: string;
  author?: PublicUser;
  privacy: PostPrivacy;
  isAwayMessage: boolean;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  _count?: { replies: number; nudges: number };
  nudgedByMe?: boolean;
}

// ---------------------------------------------------------------------------
// Reply
// ---------------------------------------------------------------------------

export interface Reply {
  id: string;
  createdAt: Date;
  content: string;
  authorId: string;
  author?: PublicUser;
  postId: string;
}

// ---------------------------------------------------------------------------
// Nudge
// ---------------------------------------------------------------------------

export interface Nudge {
  id: string;
  createdAt: Date;
  userId: string;
  postId: string;
}

// ---------------------------------------------------------------------------
// BuddyRelation
// ---------------------------------------------------------------------------

export interface BuddyRelation {
  id: string;
  createdAt: Date;
  requesterId: string;
  requester?: PublicUser;
  addresseeId: string;
  addressee?: PublicUser;
  status: BuddyStatus;
}

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

export interface Channel {
  id: string;
  createdAt: Date;
  name: string;
  description: string | null;
  isPrivate: boolean;
  creatorId: string;
  creator?: PublicUser;
  type: ChannelType;
  slowModeMinutes: number;
  memberCap: number | null;
  _count?: { members: number; messages: number };
}

// ---------------------------------------------------------------------------
// ChannelMember
// ---------------------------------------------------------------------------

export interface ChannelMember {
  id: string;
  joinedAt: Date;
  lastMessageAt: Date | null;
  userId: string;
  user?: PublicUser;
  channelId: string;
}

// ---------------------------------------------------------------------------
// ChannelMessage
// ---------------------------------------------------------------------------

export interface ChannelMessage {
  id: string;
  createdAt: Date;
  content: string;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  authorId: string;
  author?: PublicUser;
  channelId: string;
  isEncrypted: boolean;
  encryptedContent: string | null;
  encapsulatedKey: string | null;
  iv: string | null;
  keyVersion: number | null;
}

// ---------------------------------------------------------------------------
// ChannelThread
// ---------------------------------------------------------------------------

export interface ChannelThread {
  id: string;
  createdAt: Date;
  parentMessageId: string;
  channelId: string;
  messageCount: number;
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export interface Board {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  displayName: string;
  vibeStatement: string;
  type: BoardType;
  creatorId: string;
  creator?: PublicUser;
  memberCount: number;
  isMember?: boolean;
  isFoundingMember?: boolean;
}

// ---------------------------------------------------------------------------
// BoardMember
// ---------------------------------------------------------------------------

export interface BoardMember {
  id: string;
  joinedAt: Date;
  userId: string;
  user?: PublicUser;
  boardId: string;
  isFoundingMember: boolean;
}

// ---------------------------------------------------------------------------
// BoardPost
// ---------------------------------------------------------------------------

export interface BoardPost {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  body: string | null;
  authorId: string;
  author?: PublicUser;
  boardId: string;
  board?: Pick<Board, "id" | "name" | "displayName">;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  tag: string | null;
  isArchived: boolean;
  nudgeCount: number;
  commentCount: number;
  isEncrypted: boolean;
  encryptedBody: string | null;
  encapsulatedKey: string | null;
  iv: string | null;
  nudgedByMe?: boolean;
  savedByMe?: boolean;
}

// ---------------------------------------------------------------------------
// BoardComment
// ---------------------------------------------------------------------------

export interface BoardComment {
  id: string;
  createdAt: Date;
  body: string;
  authorId: string;
  author?: PublicUser;
  boardPostId: string;
  parentCommentId: string | null;
  replies?: BoardComment[];
  _count?: { nudges: number };
  nudgedByMe?: boolean;
}

// ---------------------------------------------------------------------------
// BoardNudge
// ---------------------------------------------------------------------------

export interface BoardNudge {
  id: string;
  createdAt: Date;
  userId: string;
  boardPostId: string;
}

// ---------------------------------------------------------------------------
// InviteLink
// ---------------------------------------------------------------------------

export interface InviteLink {
  id: string;
  createdAt: Date;
  token: string;
  channelId: string | null;
  boardId: string | null;
  createdById: string;
  expiresAt: Date;
  maxUses: number;
  useCount: number;
  isRevoked: boolean;
}

// ---------------------------------------------------------------------------
// Tip
// ---------------------------------------------------------------------------

export interface Tip {
  id: string;
  createdAt: Date;
  amount: number;
  senderId: string;
  sender?: PublicUser;
  recipientId: string;
  recipient?: PublicUser;
  message: string | null;
  stripePaymentIntentId: string;
}
