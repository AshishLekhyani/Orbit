interface OrbitLogoProps {
  size?: number;
  className?: string;
}

export function OrbitLogo({ size = 22, className }: OrbitLogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#17181C" stroke="#2A2C31" />
      <path d="M12 4.5 L19 12 L12 19.5 L5 12 Z" fill="none" stroke="#E8833A" strokeWidth="1.6" />
      <rect x="8" y="11.1" width="8" height="1.8" fill="#E8833A" />
    </svg>
  );
}
