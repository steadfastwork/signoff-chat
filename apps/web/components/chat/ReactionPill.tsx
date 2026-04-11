"use client";

interface ReactionPillProps {
  emoji: string;
  count: number;
  hasReacted: boolean;
  onClick: () => void;
}

export function ReactionPill({ emoji, count, hasReacted, onClick }: ReactionPillProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono transition-all active:scale-95"
      style={{
        background: hasReacted ? "#3a2a0a" : "#1a1a0e",
        border: `1px solid ${hasReacted ? "#78350f" : "rgba(255,255,255,0.08)"}`,
        color: hasReacted ? "#fcd34d" : "#9ca3af",
      }}
    >
      <span>{emoji}</span>
      <span>{count}</span>
    </button>
  );
}
