"use client";

import { useState } from "react";
import { getInitials } from "@/lib/utils";

export interface BuddyRequestData {
  requesterId: string;
  screenname: string;
  isGoldMember: boolean;
}

interface BuddyRequestProps {
  request: BuddyRequestData;
  onAccept: (requesterId: string) => Promise<void>;
  onDecline: (requesterId: string) => Promise<void>;
}

export function BuddyRequest({ request, onAccept, onDecline }: BuddyRequestProps) {
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);

  async function handleAccept() {
    setLoading("accept");
    await onAccept(request.requesterId);
    setLoading(null);
  }

  async function handleDecline() {
    setLoading("decline");
    await onDecline(request.requesterId);
    setLoading(null);
  }

  return (
    <div className="mx-2 my-1.5 rounded-lg border border-green-900/60 bg-green-950/25 p-2.5">
      {/* Requester info */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-8 h-8 rounded-lg bg-green-900 flex items-center justify-center flex-shrink-0">
          <span className="text-[11px] font-bold text-green-300 font-mono">
            {getInitials(request.screenname)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono font-bold text-green-300 truncate">
            {request.screenname}
            {request.isGoldMember && (
              <span className="ml-0.5 text-[10px]" style={{ color: "#d4a017" }}>★</span>
            )}
          </p>
          <p className="text-[10px] font-mono text-green-800 leading-tight">
            wants to add you
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          onClick={handleAccept}
          disabled={!!loading}
          className="flex-1 h-7 rounded text-[11px] font-mono font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: loading === "accept" ? "#14532d" : "#166534",
            color: "#bbf7d0",
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.background = "#15803d";
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.background = "#166534";
          }}
        >
          {loading === "accept" ? "..." : "accept"}
        </button>
        <button
          onClick={handleDecline}
          disabled={!!loading}
          className="flex-1 h-7 rounded text-[11px] font-mono border border-green-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-green-800 hover:text-green-600 hover:border-green-700"
        >
          {loading === "decline" ? "..." : "decline"}
        </button>
      </div>
    </div>
  );
}
