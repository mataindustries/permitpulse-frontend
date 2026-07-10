import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "ai"
  | "arrow-right"
  | "cases"
  | "check"
  | "evidence"
  | "founder"
  | "logo"
  | "mission"
  | "packets"
  | "plus"
  | "refresh"
  | "timeline"
  | "warning";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

const iconPaths: Record<Exclude<IconName, "logo">, ReactNode> = {
  ai: (
    <>
      <path d="M12 2.8v3.1M12 18.1v3.1M2.8 12h3.1M18.1 12h3.1" />
      <path d="M7.2 7.2 5 5M19 19l-2.2-2.2M16.8 7.2 19 5M5 19l2.2-2.2" />
      <circle cx="12" cy="12" r="3.1" />
    </>
  ),
  "arrow-right": <path d="M5 12h14M14 7l5 5-5 5" />,
  cases: (
    <>
      <path d="M3.5 7.5h6l1.6 2h9.4v9.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19Z" />
      <path d="M3.5 9.5v-4A1.5 1.5 0 0 1 5 4h4l1.5 2H19" />
    </>
  ),
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  evidence: (
    <>
      <path d="M6 3.5h8l4 4v13H6Z" />
      <path d="M14 3.5v4h4M9 12h6M9 16h6" />
    </>
  ),
  founder: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20c.5-4 2.6-6 6.5-6s6 2 6.5 6" />
    </>
  ),
  mission: (
    <>
      <path d="M3 12h4l2-5 3.1 10 2.3-6 1.6 3h5" />
      <path d="M5 4.5h14M5 19.5h14" opacity=".45" />
    </>
  ),
  packets: (
    <>
      <path d="M6 3.5h8l4 4v13H6Z" />
      <path d="M14 3.5v4h4M9 12h6M9 16h6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: (
    <>
      <path d="M19 7v5h-5" />
      <path d="M18 12a6.5 6.5 0 1 0-1.5 4" />
    </>
  ),
  timeline: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.5 21 20H3Z" />
      <path d="M12 9v4.5M12 17h.01" />
    </>
  ),
};

export function Icon({ name, size = 20, ...props }: IconProps) {
  if (name === "logo") {
    return (
      <svg
        aria-hidden="true"
        fill="none"
        height={size}
        viewBox="0 0 24 24"
        width={size}
        {...props}
      >
        <path
          d="m12 2.5 7.8 4.4v10.2L12 21.5l-7.8-4.4V6.9Z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="m12 7.2 4.1 2.3v5L12 16.8l-4.1-2.3v-5Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {iconPaths[name]}
    </svg>
  );
}
