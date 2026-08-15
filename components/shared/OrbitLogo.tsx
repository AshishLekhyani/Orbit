import { useId } from "react";

interface OrbitLogoProps {
  size?: number;
  className?: string;
}

export function OrbitLogo({ size = 22, className }: OrbitLogoProps) {
  const gradientId = useId();

  if (size < 28) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
        <rect x="1" y="1" width="98" height="98" rx="25" fill="#16181C" stroke="#2A2C31" strokeWidth="2" />
        <ellipse
          cx="50"
          cy="50"
          rx="37"
          ry="19"
          transform="rotate(-28 50 50)"
          stroke="#E8833A"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <circle cx="50" cy="50" r="15" fill="#E9E8E4" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
      <defs>
        <linearGradient id={gradientId} x1="15" y1="0" x2="85" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1A1C20" />
          <stop offset="1" stopColor="#101114" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="98" height="98" rx="23" fill={`url(#${gradientId})`} stroke="#2A2C31" strokeWidth="2" />
      <ellipse
        cx="50"
        cy="50"
        rx="38"
        ry="20"
        transform="rotate(-28 50 50)"
        stroke="#E8833A"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="13" fill="#E9E8E4" />
      <circle cx="78" cy="34" r="9" fill="#E8833A" stroke="#101114" strokeWidth="6" />
    </svg>
  );
}
