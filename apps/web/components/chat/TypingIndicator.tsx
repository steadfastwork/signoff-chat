"use client";

interface TypingIndicatorProps {
  /** List of screennames currently typing */
  typers: string[];
}

export function TypingIndicator({ typers }: TypingIndicatorProps) {
  if (typers.length === 0) return null;

  let label: string;
  if (typers.length === 1) {
    label = `${typers[0]} is typing`;
  } else if (typers.length === 2) {
    label = `${typers[0]} and ${typers[1]} are typing`;
  } else {
    label = `${typers[0]} and ${typers.length - 1} others are typing`;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-1">
      {/* Animated dots */}
      <div className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block w-1 h-1 rounded-full"
            style={{
              background: "#6b7280",
              animation: "typing-bounce 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      <span className="text-[11px] font-mono" style={{ color: "#6b7280" }}>
        {label}
      </span>
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
