import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    screenname: string;
    isGoldMember: boolean;
    adminRole: string | null;
    isSuspended: boolean;
    suspendedUntil: string | null;
  }

  interface Session {
    user: {
      id: string;
      screenname: string;
      isGoldMember: boolean;
      adminRole: string | null;
      avatarColor: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    screenname: string;
    isGoldMember: boolean;
    adminRole: string | null;
    avatarColor: string;
    isSuspended: boolean;
    suspendedUntil: string | null;
    suspensionCheckedAt: number;
  }
}
