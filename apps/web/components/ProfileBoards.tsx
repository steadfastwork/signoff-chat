"use client";

import Link from "next/link";

interface Board {
  name: string;
  displayName: string;
}

interface ProfileBoardsProps {
  boards: Board[];
}

export function ProfileBoards({ boards }: ProfileBoardsProps) {
  if (boards.length === 0) return null;

  return (
    <div>
      <h3
        className="text-[10px] font-mono uppercase tracking-widest mb-2"
        style={{ color: "#2dd4bf66" }}
      >
        boards
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {boards.map((board) => (
          <Link
            key={board.name}
            href={`/boards/${board.name}`}
            className="text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-colors"
            style={{
              background: "rgba(45,212,191,0.06)",
              color: "#2dd4bf",
              borderColor: "rgba(45,212,191,0.15)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background =
                "rgba(45,212,191,0.12)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background =
                "rgba(45,212,191,0.06)";
            }}
          >
            {board.displayName}
          </Link>
        ))}
      </div>
    </div>
  );
}
