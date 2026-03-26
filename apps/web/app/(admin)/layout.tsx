import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { touchAdminSession } from "@/lib/admin-auth";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.adminRole) {
    notFound();
  }

  // Touch admin session (fire-and-forget)
  touchAdminSession(session.user.id).catch(() => {});

  return (
    <AdminShell
      adminRole={session.user.adminRole}
      screenname={session.user.screenname}
    >
      {children}
    </AdminShell>
  );
}
