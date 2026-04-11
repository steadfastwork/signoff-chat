"use client";

import { FlatMessage } from "./FlatMessage";
import type { MessageGroup } from "@/lib/chat";

interface FlatMessageGroupProps {
  group: MessageGroup;
  onThreadOpen?: (msgId: string) => void;
  /** Current user's DM text color preference (DM pages only) */
  myTextColor?: string;
}

export function FlatMessageGroup({ group, onThreadOpen, myTextColor }: FlatMessageGroupProps) {
  return (
    <div style={{ paddingTop: "2px", paddingBottom: "2px" }}>
      {group.messages.map((msg) => (
        <FlatMessage
          key={msg.id}
          msg={msg}
          isOwn={group.isOwn}
          senderId={group.senderId}
          screenname={group.screenname}
          isGold={group.isGold}
          onThreadOpen={onThreadOpen}
          myTextColor={myTextColor}
        />
      ))}
    </div>
  );
}
