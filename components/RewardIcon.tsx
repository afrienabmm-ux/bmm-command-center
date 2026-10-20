import type { RewardIconName } from "@/lib/membership";

// Line icons for the free items on the stamp card (same drawings as the
// printed/shared card image). Drawn in currentColor so they follow the
// text colour of wherever they're placed.
export default function RewardIcon({ name, size = 16, className }: { name: RewardIconName; size?: number; className?: string }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 3,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (name) {
    case "oil":
      return (
        <svg {...common}>
          <rect x="9" y="20" width="22" height="18" rx="3" />
          <rect x="15" y="15" width="8" height="5" rx="1" />
          <path d="M31 24 L41 18.5 L42.5 21 L31 30" />
          <path d="M9 24 C3 24 3 34 9 34" />
          <path d="M42 26 C42 26 39.5 29.5 39.5 31.5 A2.5 2.5 0 0 0 44.5 31.5 C44.5 29.5 42 26 42 26 Z" fill="currentColor" />
          <path d="M14 27 H26" />
        </svg>
      );
    case "plug":
      return (
        <svg {...common}>
          <rect x="20.5" y="3" width="7" height="5" rx="1" />
          <path d="M19 8 H29 L30 21 H18 Z" />
          <path d="M21 12 H27 M21 16 H27" />
          <rect x="14" y="21" width="20" height="6" rx="1.5" />
          <rect x="18" y="27" width="12" height="10" rx="1" />
          <path d="M18 30.5 H30 M18 33.5 H30" />
          <path d="M24 37 V41" />
          <path d="M20 37 V44 H27" />
        </svg>
      );
    case "coolant":
      return (
        <svg {...common}>
          <path d="M21 9 A3 3 0 0 1 27 9 V24 A6.5 6.5 0 1 1 21 24 Z" />
          <path d="M24 15 V28" />
          <circle cx="24" cy="29.5" r="2.4" fill="currentColor" />
          <path d="M30 12 H34 M30 17 H34 M30 22 H34" />
          <path d="M5 41 Q9.5 37.5 14 41 T23 41 T32 41 T41 41 T45 40" />
        </svg>
      );
    case "helmet":
      return (
        <svg {...common}>
          <path d="M6 32 C6 18 15.5 9 27 9 C37.5 9 43.5 16.5 43.5 25 V33 A3.5 3.5 0 0 1 40 36.5 H9.5 A3.5 3.5 0 0 1 6 33 Z" />
          <path d="M43.5 21 H29 C26 21 24.5 23 24.5 25.5 C24.5 28 26 30 29 30 H43.5" />
          <path d="M11 26 C12 19 16 15 21 13.5" />
        </svg>
      );
  }
}
