"use client";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

interface ReactionHoverBarProps {
  onReact: (emoji: string) => void;
  isOwn: boolean;
}

export function ReactionHoverBar({ onReact, isOwn }: ReactionHoverBarProps) {
  return (
    <div
      className={`flex items-center gap-0.5 px-1.5 py-1 rounded-xl shadow-lg
        absolute top-1/2 -translate-y-1/2 z-10
        ${isOwn ? "right-full mr-2" : "left-full ml-2"}`}
      style={{
        background: "#1a1a0e",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-base hover:scale-125 transition-transform active:scale-110"
          style={{ background: "transparent" }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
