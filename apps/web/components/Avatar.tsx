"use client";

import Image from "next/image";
import { getInitials } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { container: "w-8 h-8", text: "text-xs" },
  md: { container: "w-10 h-10", text: "text-sm" },
  lg: { container: "w-16 h-16", text: "text-lg" },
};

export function Avatar({ src, name, size = "md" }: AvatarProps) {
  const { container, text } = sizeMap[size];

  if (src) {
    return (
      <div className={`${container} relative rounded-full overflow-hidden border-2 border-green-400 flex-shrink-0`}>
        <Image src={src} alt={name} fill className="object-cover" />
      </div>
    );
  }

  return (
    <div
      className={`${container} rounded-full border-2 border-green-400 bg-green-900 flex items-center justify-center flex-shrink-0`}
    >
      <span className={`${text} font-bold text-green-300 font-mono`}>
        {getInitials(name)}
      </span>
    </div>
  );
}
