import type { ReactNode, SVGProps } from "react";

type IconName =
  | "arrow-left"
  | "arrow-right"
  | "chevron-left"
  | "clock"
  | "close"
  | "list"
  | "pause"
  | "play"
  | "search"
  | "settings"
  | "volume";

type UiIconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: number;
};

const paths: Record<IconName, ReactNode> = {
  "arrow-left": (
    <>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  clock: (
    <>
      <circle
        cx="12"
        cy="12"
        r="8.5"
      />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  close: (
    <>
      <path d="m7 7 10 10" />
      <path d="M17 7 7 17" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h10M9 12h10M9 18h10" />
      <path d="M5 6h.01M5 12h.01M5 18h.01" />
    </>
  ),
  pause: (
    <>
      <path d="M9 7v10" />
      <path d="M15 7v10" />
    </>
  ),
  play: <path d="m9 7 8 5-8 5Z" />,
  search: (
    <>
      <circle
        cx="11"
        cy="11"
        r="6.5"
      />
      <path d="m16 16 4 4" />
    </>
  ),
  settings: (
    <>
      <circle
        cx="12"
        cy="12"
        r="3"
      />
      <path
        d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3l-.7 2-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7Z"
        transform="translate(2.25 0) scale(.81)"
      />
    </>
  ),
  volume: (
    <>
      <path d="M5 10v4h3l4 3V7l-4 3H5Z" />
      <path d="M15 9.5a4 4 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" />
    </>
  ),
};

export default function UiIcon({ name, size = 18, ...props }: UiIconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
