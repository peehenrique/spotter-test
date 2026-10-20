import type { ReactNode } from "react";

interface IconProps {
  size?: number;
}

function Svg({ size = 20, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function LogoMark({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#2f6bff" />
      <path d="M21.6 11a7.4 7.4 0 1 0 0 10" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconHome({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </Svg>
  );
}

export function IconClipboard({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 4.5h6a1 1 0 0 1 1 1V7H8V5.5a1 1 0 0 1 1-1z" />
      <path d="M9 11h6M9 14.5h4" />
    </Svg>
  );
}

export function IconUser({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="8" r="3" />
      <path d="M5.5 19.5c1.2-3 3.4-4.5 6.5-4.5s5.3 1.5 6.5 4.5" />
    </Svg>
  );
}

export function IconTruck({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
      <circle cx="7" cy="17.5" r="1.5" />
      <circle cx="17" cy="17.5" r="1.5" />
    </Svg>
  );
}

export function IconPhoto({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="m8 16 2.5-2.5L16 17" />
    </Svg>
  );
}

export function IconChart({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M5 19V10M12 19V5M19 19v-7" />
    </Svg>
  );
}

export function IconSettings({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.8 6.2l1.6 1.6M17.6 16.2l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.8 17.8l1.6-1.6M17.6 7.8l1.6-1.6" />
    </Svg>
  );
}

export function IconExpand({ size = 16 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M8 16H5.5A1.5 1.5 0 0 1 4 14.5V8" />
      <path d="M14 8h4.5M18.5 8v4.5" />
      <path d="M18.2 8.2 10 16.4" />
    </Svg>
  );
}

export function IconInfo({ size = 16 }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconClose({ size = 12 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function IconArrowUp({ size = 18 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 18V7" />
      <path d="m7.5 11 4.5-4.5L16.5 11" />
    </Svg>
  );
}

export function IconBox({ size = 16 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M4 8.5 12 4l8 4.5-8 4.5z" />
      <path d="M4 8.5V16l8 4 8-4V8.5" />
      <path d="M12 13v7" />
    </Svg>
  );
}

export function IconMoon({ size = 16 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M16 14.5A7 7 0 0 1 9.2 5 6.2 6.2 0 1 0 16 14.5z" />
    </Svg>
  );
}

export function IconSun({ size = 16 }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.4 6.4l1.4 1.4M16.2 16.2l1.4 1.4M17.6 6.4l-1.4 1.4M7.8 16.2l-1.4 1.4" />
    </Svg>
  );
}

export function IconFlag({ size = 16 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M6 20V4" />
      <path d="M6 5h10l-2 3.2L16 12H6" />
    </Svg>
  );
}
