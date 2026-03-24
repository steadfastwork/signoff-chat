import { Suspense } from "react";
import { SuspendedContent } from "./suspended-content";

export const metadata = {
  title: "Account suspended — Signoff Chat",
  robots: "noindex",
};

export default function SuspendedPage() {
  return (
    <Suspense fallback={null}>
      <SuspendedContent />
    </Suspense>
  );
}
