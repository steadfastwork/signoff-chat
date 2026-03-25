import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DirectMessagePanel } from "@/components/DirectMessagePanel";

export default async function DMPage({ params }: { params: { userId: string } }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (params.userId === session.user.id) redirect("/");

  const otherUser = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, screenname: true, isGoldMember: true },
  });
  if (!otherUser) notFound();

  return (
    <div
      className="max-w-2xl mx-auto border-x h-[calc(100vh-52px)]"
      style={{ borderColor: "var(--border)" }}
    >
      <DirectMessagePanel otherUser={otherUser} />
    </div>
  );
}
