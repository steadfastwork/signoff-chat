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
    onboardingComplete: boolean;
    onboardingStep: number;
  }

  interface Session {
    user: {
      id: string;
      screenname: string;
      isGoldMember: boolean;
      adminRole: string | null;
      avatarColor: string;
    };
    /** True when the RADICAL_UX feature flag is active for this user. */
    radicalUXEnabled: boolean;
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
    onboardingComplete: boolean;
    onboardingStep: number;
  }
}
