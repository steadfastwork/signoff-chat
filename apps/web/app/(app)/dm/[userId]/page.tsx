import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DirectMessagePanel } from "@/components/DirectMessagePanel";

export default async function DMPage({
  params,
  searchParams,
}: {
  params: { userId: string };
  searchParams: { quote?: string };
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (params.userId === session.user.id) redirect("/");

  const otherUser = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, screenname: true, isGoldMember: true },
  });
  if (!otherUser) notFound();

  const quote = searchParams.quote
    ? `> ${searchParams.quote}\n\n`
    : undefined;

  return (
    <div
      className="max-w-2xl mx-auto border-x"
      style={{
        borderColor: "var(--border)",
        height: "calc(100dvh - 52px - var(--tab-bar-h))",
      }}
    >
      <DirectMessagePanel otherUser={otherUser} initialDraft={quote} />
    </div>
  );
}
