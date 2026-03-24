import { Feed } from "@/components/Feed";

export default function FeedPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1
        className="font-vt323 mb-5 select-none"
        style={{ fontSize: 22, color: "var(--amber)", lineHeight: 1 }}
      >
        // feed
      </h1>
      <Feed />
    </div>
  );
}
