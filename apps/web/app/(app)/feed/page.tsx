import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isRadicalUXEnabled } from "@/lib/featureFlags";
import { FeedPageClient } from "./FeedPageClient";
import { RadicalLayout } from "@/components/radical/RadicalLayout";

export default async function FeedPage() {
  const session = await getServerSession(authOptions);
  const isRadical = await isRadicalUXEnabled(session?.user?.id);

  if (isRadical) {
    return <RadicalLayout />;
  }
  return <FeedPageClient />;
}
