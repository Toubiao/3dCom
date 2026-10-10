import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = ({ size = 18, ...rest }: P) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...rest,
});

export const IconPlan = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="1" />
    <path d="M3.5 12h7v8.5M14 3.5v6h6.5" />
  </svg>
);
export const IconCube = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
    <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
  </svg>
);
export const IconSplit = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
    <path d="M12 4.5v15" />
    <path d="M5.5 8h4M14.5 15l2-2 2 2" />
  </svg>
);
export const IconExit = (p: P) => (
  <svg {...base(p)}>
    <path d="M13 4h6v16h-6" />
    <path d="M4 12h10M10 8l4 4-4 4" />
  </svg>
);
export const IconPalette = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3a9 9 0 1 0 0 18c1.4 0 1.8-1 1.3-2-.6-1.1.1-2.4 1.4-2.4H17a4 4 0 0 0 4-4C21 7 17 3 12 3Z" />
    <circle cx="7.5" cy="11" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="10.5" cy="7.2" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="7.6" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);
export const IconReceipt = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </svg>
);
export const IconDownload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
  </svg>
);
export const IconUndo = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 7 4.5 11.5 9 16" />
    <path d="M5 11.5h9.5a5 5 0 0 1 0 10H12" />
  </svg>
);
export const IconRedo = (p: P) => (
  <svg {...base(p)}>
    <path d="m15 7 4.5 4.5L15 16" />
    <path d="M19 11.5H9.5a5 5 0 0 0 0 10H12" />
  </svg>
);
export const IconRotate = (p: P) => (
  <svg {...base(p)}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4v4.5H15" />
  </svg>
);
export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="8" y="8" width="12" height="12" rx="1.5" />
    <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
  </svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.5 7h15M10 4h4M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />
  </svg>
);
export const IconMagnet = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 4v8a6 6 0 0 0 12 0V4" />
    <path d="M6 8h3M15 8h3M9 4v8a3 3 0 0 0 6 0V4" />
  </svg>
);
export const IconFit = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    <rect x="8.5" y="8.5" width="7" height="7" rx="1" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.4-4.4" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconAlert = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4 21 19.5H3z" />
    <path d="M12 10v4.5M12 17.2v.3" />
  </svg>
);
export const IconChevron = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const IconArrowDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" />
  </svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconMinus = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);
export const IconCup = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" />
    <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c0 1.5 1 1.5 1 3M11.5 3.5c0 1.5 1 1.5 1 3" />
  </svg>
);
export const IconDesk = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 10h18M5 10v9M19 10v9M9 6.5h6V10H9z" />
  </svg>
);
export const IconHanger = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 8.5a2 2 0 1 1 2-2c0 1.2-2 1.4-2 3V10L3.5 16.5a1 1 0 0 0 .6 1.8h15.8a1 1 0 0 0 .6-1.8L12 10" />
  </svg>
);
export const IconPlate = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="3" />
    <path d="M3 5v5a1.5 1.5 0 0 0 3 0V5M4.5 10v9M20 5c-1.5 1-2 3-2 6h2v8" />
  </svg>
);
export const IconUsers = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.8a3 3 0 0 1 0 5.4M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
  </svg>
);
export const IconSparkle = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5 13.8 10l6.7 2-6.7 2L12 20.5 10.2 14l-6.7-2 6.7-2z" />
  </svg>
);

export const TEMPLATE_ICON = {
  cafe: IconCup,
  cowork: IconDesk,
  boutique: IconHanger,
  restaurant: IconPlate,
} as const;
