import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useState } from "react";
import Avatar from "@/components/Avatar";

// ---------------------------------------------------------------------------
// Pending buddy requests — received only.
//
// NO timestamps. We do not store or show when a request was sent.
// "[screenname] wants to be your buddy." Full stop.
// ---------------------------------------------------------------------------

const C = {
  amberTint:   "rgba(245,200,66,0.07)",
  amberBorder: "rgba(245,200,66,0.25)",
  amber:       "#f5c842",
  text:        "#e8e4d9",
  muted:       "#7a7060",
  border:      "#2c2820",
  bg:          "#191714",
};

export interface PendingRequest {
  relationId: string;
  fromUserId: string;
  screenname: string;
  avatarColor: string;
  // Deliberately no createdAt.
}

interface Props {
  requests: PendingRequest[];
  onAccept: (relationId: string) => Promise<void>;
  onDecline: (relationId: string) => Promise<void>;
}

function RequestRow({
  req,
  onAccept,
  onDecline,
}: {
  req: PendingRequest;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}) {
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);

  const handle = async (action: "accept" | "decline") => {
    setLoading(action);
    try {
      action === "accept" ? await onAccept() : await onDecline();
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={styles.requestRow}>
      <Avatar screenname={req.screenname} color={req.avatarColor} size={36} />
      <View style={styles.requestInfo}>
        <Text style={styles.requestText}>
          <Text style={styles.requestName}>{req.screenname}</Text>
          {" wants to be your buddy."}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => handle("accept")}
          disabled={loading !== null}
          activeOpacity={0.8}
        >
          {loading === "accept"
            ? <ActivityIndicator size="small" color="#0f0e0c" />
            : <Text style={styles.acceptText}>Accept</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={() => handle("decline")}
          disabled={loading !== null}
          activeOpacity={0.8}
        >
          {loading === "decline"
            ? <ActivityIndicator size="small" color={C.muted} />
            : <Text style={styles.declineText}>Decline</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PendingCard({ requests, onAccept, onDecline }: Props) {
  if (!requests.length) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {requests.length} pending {requests.length === 1 ? "request" : "requests"}
      </Text>
      {requests.map((req) => (
        <RequestRow
          key={req.relationId}
          req={req}
          onAccept={() => onAccept(req.relationId)}
          onDecline={() => onDecline(req.relationId)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.amberTint,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.amberBorder,
    paddingTop: 12,
    paddingBottom: 4,
  },
  cardTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    color: C.amber,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  requestInfo: { flex: 1 },
  requestText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.text,
    lineHeight: 18,
  },
  requestName: {
    fontFamily: "DMSans_700Bold",
    color: C.text,
  },
  actions: {
    flexDirection: "row",
    gap: 6,
  },
  acceptBtn: {
    backgroundColor: C.amber,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 64,
    alignItems: "center",
  },
  acceptText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: "#0f0e0c",
  },
  declineBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 64,
    alignItems: "center",
  },
  declineText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
  },
});
