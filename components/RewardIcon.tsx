import type { RewardIconName } from "@/lib/membership";

// Line icons for the free items on the stamp card (same drawings as the
// shared card image — the boss picked these on 2026-10-20). Drawn in
// currentColor so they follow the text colour of wherever they're placed.
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
    // Engine oil bottle
    case "oil":
      return (
        <svg {...common}>
          <path d="M17 6 H25 V11 H17 Z" />
          <path d="M13 11 H31 L35 17 V40 A3 3 0 0 1 32 43 H14 A3 3 0 0 1 11 40 V14 Z" />
          <path d="M27 11 L34 6" />
          <rect x="16" y="22" width="14" height="12" rx="2" />
          <path d="M23 25 C23 25 20.5 28.5 20.5 30 A2.5 2.5 0 0 0 25.5 30 C25.5 28.5 23 25 23 25 Z" fill="currentColor" />
        </svg>
      );
    // Diagnostic scanner with a spark plug beside it
    case "scannerPlug":
      return (
        <svg {...common}>
          <rect x="6" y="9" width="21" height="27" rx="3.5" />
          <rect x="10" y="13" width="13" height="9" rx="1.5" />
          <path d="M12 19 L15 16 L18 19 L21 15" />
          <path d="M16.5 36 V42" />
          <rect x="34" y="4" width="5" height="4" rx="1" />
          <path d="M33 8 H40 L40.6 18 H32.4 Z" />
          <rect x="30" y="18" width="13" height="5" rx="1" />
          <rect x="33" y="23" width="7" height="9" rx="1" />
          <path d="M36.5 32 V37 M33.5 32 V39 H38.5" />
        </svg>
      );
    // Coolant bottle with a snowflake
    case "coolant":
      return (
        <svg {...common}>
          <path d="M18 5 H26 V10 H18 Z" />
          <path d="M14 10 H30 L34 16 V40 A3 3 0 0 1 31 43 H15 A3 3 0 0 1 12 40 V13 Z" />
          <path d="M23 21 V35 M17 24.5 L29 31.5 M29 24.5 L17 31.5" />
          <path d="M21 21 L23 23 L25 21 M21 35 L23 33 L25 35" />
        </svg>
      );
    // RM50 voucher ticket
    case "voucher":
      return (
        <svg {...common}>
          <path d="M3 13 H45 V20 A4 4 0 0 0 45 28 V35 H3 V28 A4 4 0 0 0 3 20 Z" />
          <path d="M12 13 V35" strokeDasharray="3 3" />
          <text x="27.5" y="27.4" textAnchor="middle" fontSize="7.4" fontWeight={800} fill="currentColor" stroke="none">
            RM50
          </text>
        </svg>
      );
  }
}
