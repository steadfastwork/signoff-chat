import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    screenname: string;
    isGoldMember: boolean;
    isAdmin: boolean;
  }

  interface Session {
    user: {
      id: string;
      screenname: string;
      isGoldMember: boolean;
      isAdmin: boolean;
      avatarColor: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    screenname: string;
    isGoldMember: boolean;
    isAdmin: boolean;
    avatarColor: string;
  }
}
