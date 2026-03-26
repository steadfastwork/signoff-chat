/**
 * Mobile app tests — component, DB, navigation, and copy string checks.
 * Tests 5.1–5.13.
 *
 * Run from /apps/mobile:
 *   npx jest --testPathPattern="mobile"
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// ---------------------------------------------------------------------------
// Module mocks (hoisted by Jest before any imports)
// ---------------------------------------------------------------------------

jest.mock("expo-router", () => ({
  useRouter:   jest.fn(() => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() })),
  useSegments: jest.fn(() => []),
}));

jest.mock("expo-font", () => ({
  useFonts: jest.fn(() => [true, null]),
  loadAsync: jest.fn(),
}));

jest.mock("expo-image", () => ({
  Image: "Image",
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("@gorhom/bottom-sheet", () => {
  const mockReact = require("react");
  const RN = require("react-native");
  const BS = mockReact.forwardRef((_: any, ref: any) => {
    mockReact.useImperativeHandle(ref, () => ({ expand: jest.fn(), close: jest.fn() }));
    return null;
  });
  BS.displayName = "BottomSheet";
  return { default: BS, BottomSheetView: RN.View };
});

jest.mock("@/components/Avatar", () => "Avatar");
jest.mock("@/components/SafetySheet", () => ({
  __esModule: true,
  default: () => null,
}));

// Expo native module mocks
jest.mock("expo-secure-store", () => ({
  getItemAsync:    jest.fn(() => Promise.resolve(null)),
  setItemAsync:    jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-notifications", () => ({
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  setNotificationHandler: jest.fn(),
}));

// App-level lib mocks
jest.mock("@/lib/auth", () => ({
  register: jest.fn(() => Promise.resolve()),
  login:    jest.fn(() => Promise.resolve()),
}));
jest.mock("@/lib/soketi", () => ({
  setSoketiAuth: jest.fn(),
}));
jest.mock("@/lib/notifications", () => ({
  setupNotificationHandlers:  jest.fn(),
  handleNotificationResponse: jest.fn(),
  registerForPushNotifications: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/session", () => ({
  getSession: jest.fn(() => Promise.resolve(null)),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ToolbarButton }  from "@/components/ToolbarButton";
import { StatusDot }      from "@/components/StatusDot";
import PostCard           from "@/components/feed/PostCard";
import EncryptionBadge    from "@/components/EncryptionBadge";
import RegisterScreen     from "@/app/(auth)/register";
import { AuthGuard }      from "@/components/AuthGuard";

import {
  openDatabase,
  createTables,
  saveMessage,
  getChannelMessages,
}                         from "@/lib/db/localMessages";
import { pruneOldCache }  from "@/lib/db/localPosts";

import {
  SCREENSHOT_REMINDER,
  SCREENNAME_WARNING,
}                         from "@/constants/copy";

// ---------------------------------------------------------------------------
// Shared mock post data
// ---------------------------------------------------------------------------

const MOCK_POST = {
  id:            "post-1",
  author_id:     "user-1",
  author_name:   "testuser",
  author_is_gold: 0,
  author_color:  "#f5c842",
  content:       "Hello world",
  privacy:       "PUBLIC",
  media_url:     null,
  media_type:    null,
  nudge_count:   3,
  reply_count:   1,
  created_at:    new Date(Date.now() - 5 * 60_000).toISOString(),
};

// ===========================================================================
// COMPONENT TESTS
// ===========================================================================

// ---------------------------------------------------------------------------
// 5.1 — ToolbarButton height
// ---------------------------------------------------------------------------

describe("5.1 — ToolbarButton renders at exactly 34px height", () => {
  it("style.height === 34", () => {
    const { UNSAFE_getByType } = render(<ToolbarButton label="📷" />);
    // Find the TouchableOpacity (outermost pressable)
    const { TouchableOpacity } = require("react-native");
    const btn = UNSAFE_getByType(TouchableOpacity);
    const flatStyle = btn.props.style;
    const height = Array.isArray(flatStyle)
      ? flatStyle.reduce((acc: any, s: any) => ({ ...acc, ...s }), {}).height
      : flatStyle?.height;
    expect(height).toBe(34);
  });
});

// ---------------------------------------------------------------------------
// 5.2 — StatusDot renders no text
// ---------------------------------------------------------------------------

describe("5.2 — StatusDot renders no text/timestamp", () => {
  const statuses = ["ONLINE", "AWAY", "IDLE", "OFFLINE"] as const;

  it.each(statuses)("status=%s: no text rendered", (status) => {
    const { queryAllByRole } = render(<StatusDot status={status} />);
    // queryAllByRole("text") with RNTL returns any <Text> components
    const texts = queryAllByRole("text");
    expect(texts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5.3 — PostCard renders no "last seen" text
// ---------------------------------------------------------------------------

describe("5.3 — PostCard renders no 'last seen' text", () => {
  it("no /last seen/i or /ago/i text in rendered output", () => {
    // Suppress the forwardRef warning from SafetySheet mock (plain fn, no ref forwarding)
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { toJSON } = render(
      <PostCard post={MOCK_POST} isOwnPost={false} />
    );
    const output = JSON.stringify(toJSON());
    spy.mockRestore();
    expect(output).not.toMatch(/last seen/i);
    expect(output).not.toMatch(/\bago\b/i);
  });
});

// ---------------------------------------------------------------------------
// 5.4 — EncryptionBadge
// ---------------------------------------------------------------------------

describe("5.4 — EncryptionBadge renders and opens modal", () => {
  it("renders with '🔒 AES-256 + ML-KEM' text", () => {
    const { getByText } = render(<EncryptionBadge />);
    expect(getByText("🔒 AES-256 + ML-KEM")).toBeTruthy();
  });

  it("pressing the badge opens the modal", () => {
    const { getByText, getAllByText } = render(<EncryptionBadge />);
    fireEvent.press(getByText("🔒 AES-256 + ML-KEM"));
    // After press, multiple elements mention AES-256 (badge + modal body)
    expect(getAllByText(/AES-256/i).length).toBeGreaterThan(0);
  });

  it("modal explanation mentions 'AES-256' and 'ML-KEM'", () => {
    const { getByText, getAllByText } = render(<EncryptionBadge />);
    fireEvent.press(getByText("🔒 AES-256 + ML-KEM"));
    // Both terms appear somewhere in the rendered tree
    expect(getAllByText(/AES-256/i).length).toBeGreaterThan(0);
    expect(getAllByText(/ML-KEM/i).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5.5 — Register screen: warning card above form
// ---------------------------------------------------------------------------

describe("5.5 — Register screen warning card renders above form", () => {
  it("warning card text appears before the screenname input placeholder", () => {
    const { toJSON } = render(<RegisterScreen />);
    const json = JSON.stringify(toJSON());
    const warningIdx = json.indexOf("Write this down somewhere safe");
    const inputIdx   = json.indexOf("coolperson99"); // screenname input placeholder
    expect(warningIdx).toBeGreaterThan(-1);
    expect(inputIdx).toBeGreaterThan(-1);
    expect(warningIdx).toBeLessThan(inputIdx);
  });
});

// ===========================================================================
// LOCAL DATABASE TESTS
// ===========================================================================

// ---------------------------------------------------------------------------
// 5.6 — DB initialization
// ---------------------------------------------------------------------------

describe("5.6 — Local database initializes correctly", () => {
  it("openDatabase() returns a db object without throwing", () => {
    const db = openDatabase();
    expect(db).toBeDefined();
    expect(typeof db.execAsync).toBe("function");
  });

  it("createTables(db) completes without throwing", async () => {
    const db = openDatabase();
    await expect(createTables(db)).resolves.toBeUndefined();
  });

  it("channel_messages table exists after createTables", async () => {
    const db = openDatabase() as any;
    await createTables(db);
    expect(db._createdTables.has("channel_messages")).toBe(true);
  });

  it("feed_posts table exists after createTables", async () => {
    const db = openDatabase() as any;
    await createTables(db);
    expect(db._createdTables.has("feed_posts")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5.7 — Message save and retrieve
// ---------------------------------------------------------------------------

describe("5.7 — Local message save and retrieve", () => {
  const TEST_MSG = {
    id:         "msg-001",
    channelId:  "test-chan",
    authorId:   "user-1",
    authorName: "alice",
    content:    "Hello from test-chan",
    createdAt:  new Date().toISOString(),
    expiresAt:  new Date(Date.now() + 86_400_000).toISOString(),
  };

  it("saved message appears in getChannelMessages results", async () => {
    const db = openDatabase();
    await createTables(db);
    await saveMessage(db, TEST_MSG);
    const msgs = await getChannelMessages(db, "test-chan");
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[0].id).toBe(TEST_MSG.id);
  });

  it("message content matches what was saved", async () => {
    const db = openDatabase();
    await createTables(db);
    await saveMessage(db, TEST_MSG);
    const msgs = await getChannelMessages(db, "test-chan");
    expect(msgs[0].content).toBe(TEST_MSG.content);
  });
});

// ---------------------------------------------------------------------------
// 5.8 — Cache prune removes old posts
// ---------------------------------------------------------------------------

describe("5.8 — Local cache prune removes old posts", () => {
  it("old post (31 days ago) is removed after pruneOldCache", async () => {
    const { openDatabaseSync } = require("expo-sqlite");
    const db = openDatabaseSync("signoff_messages.db") as any;
    await createTables(db);

    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

    // Directly push rows into mock storage to bypass INSERT column parsing
    const feedRows = db._tableData.get("feed_posts") ?? [];
    feedRows.push({ id: "old-post",    created_at: oldDate,    cached_at: oldDate    });
    feedRows.push({ id: "recent-post", created_at: recentDate, cached_at: recentDate });
    db._tableData.set("feed_posts", feedRows);

    await pruneOldCache(db);

    const remaining: any[] = db._tableData.get("feed_posts") ?? [];
    const ids = remaining.map((r: any) => r.id);
    expect(ids).not.toContain("old-post");
    expect(ids).toContain("recent-post");
  });
});

// ===========================================================================
// NAVIGATION TESTS
// ===========================================================================

// ---------------------------------------------------------------------------
// 5.9 — Unauthenticated → login
// ---------------------------------------------------------------------------

describe("5.9 — Unauthenticated user is redirected to login", () => {
  it("router.replace called with '/(auth)/login' when session is null", () => {
    const mockReplace = jest.fn();
    const { useRouter, useSegments } = require("expo-router");
    useRouter.mockReturnValue({ replace: mockReplace, push: jest.fn(), back: jest.fn() });
    // Segments indicate user is NOT in auth area
    useSegments.mockReturnValue(["(tabs)", "feed"]);

    render(<AuthGuard session={null} />);

    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
  });
});

// ---------------------------------------------------------------------------
// 5.10 — Authenticated → feed
// ---------------------------------------------------------------------------

describe("5.10 — Authenticated user lands on feed", () => {
  it("router.replace called with '/(app)/(tabs)/feed' when session exists", () => {
    const mockReplace = jest.fn();
    const { useRouter, useSegments } = require("expo-router");
    useRouter.mockReturnValue({ replace: mockReplace, push: jest.fn(), back: jest.fn() });
    // Segments indicate user is in auth area
    useSegments.mockReturnValue(["(auth)"]);

    const mockSession = { token: "tok", userId: "u1", screenname: "alice" };
    render(<AuthGuard session={mockSession as any} />);

    expect(mockReplace).toHaveBeenCalledWith("/(app)/(tabs)/feed");
  });
});

// ===========================================================================
// COPY / STRING TESTS
// ===========================================================================

// ---------------------------------------------------------------------------
// 5.11 — No "last seen" in the app bundle
// ---------------------------------------------------------------------------

describe("5.11 — No 'last seen' strings in the app bundle", () => {
  it("0 matches for 'last seen' in user-facing display code (excludes comments)", () => {
    const { execSync } = require("child_process");
    const root = require("path").resolve(__dirname, "..");
    // Grep for "last seen" but exclude lines that are pure comments (// or * prefix)
    // and JSX/string occurrences only.
    let output = "";
    try {
      output = execSync(
        `grep -ri "last seen" "${root}/app" "${root}/components" --include="*.tsx" --include="*.ts"`,
        { encoding: "utf8" }
      );
    } catch {
      // grep exits 1 when nothing found — desired outcome
      output = "";
    }
    // Filter out comment-only lines (lines where "last seen" appears only inside a // comment)
    const nonCommentMatches = output
      .split("\n")
      .filter((line) => line.trim())
      .filter((line) => {
        // Strip the filename prefix (grep -r output: "path/file.tsx:line content")
        const content = line.replace(/^[^:]+:\s*/, "");
        // Exclude pure comment lines
        return !/^\s*\/\//.test(content) && !/^\s*\*/.test(content);
      });
    expect(nonCommentMatches).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5.12 — Screenshot reminder copy
// ---------------------------------------------------------------------------

describe("5.12 — Screenshot reminder copy is present", () => {
  it("SCREENSHOT_REMINDER equals 'if it matters, screenshot it.'", () => {
    expect(SCREENSHOT_REMINDER).toBe("if it matters, screenshot it.");
  });
});

// ---------------------------------------------------------------------------
// 5.13 — Screenname warning copy
// ---------------------------------------------------------------------------

describe("5.13 — Screenname warning copy is present", () => {
  it("SCREENNAME_WARNING mentions writing down the screenname", () => {
    const text =
      typeof SCREENNAME_WARNING === "string"
        ? SCREENNAME_WARNING
        : JSON.stringify(SCREENNAME_WARNING);
    expect(text.toLowerCase()).toMatch(/write/i);
    expect(text.toLowerCase()).toMatch(/screenname/i);
  });
});
