import type { BodyRegionSummary, HealthStatus } from '../../api/types';
import { statusColor } from '../../lib/status';

export const REGION_LABELS: Record<string, string> = {
  head: 'Głowa',
  heart: 'Serce',
  chest: 'Klatka piersiowa',
  abdomen: 'Brzuch',
  arms: 'Ramiona',
  spine: 'Kręgosłup',
  back: 'Mięśnie grzbietu',
  hips: 'Biodra',
  thighs: 'Uda',
  calves: 'Łydki',
};

type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number };

interface Part {
  region: string | null; // null = neutral silhouette
  shape: Shape;
}

const rect = (x: number, y: number, w: number, h: number, r: number): Shape => ({ kind: 'rect', x, y, w, h, r });
const ellipse = (cx: number, cy: number, rx: number, ry: number): Shape => ({ kind: 'ellipse', cx, cy, rx, ry });

// Simple schematic silhouette (160 × 410). Order matters: later parts are drawn on top.
const FRONT: Part[] = [
  { region: 'head', shape: ellipse(80, 36, 21, 26) },
  { region: null, shape: rect(71, 60, 18, 14, 4) },
  { region: 'arms', shape: rect(24, 78, 18, 128, 9) },
  { region: 'arms', shape: rect(118, 78, 18, 128, 9) },
  { region: 'chest', shape: rect(46, 72, 68, 72, 16) },
  { region: 'heart', shape: ellipse(93, 102, 10, 11) },
  { region: 'abdomen', shape: rect(49, 146, 62, 50, 10) },
  { region: 'hips', shape: rect(47, 198, 66, 34, 14) },
  { region: 'thighs', shape: rect(50, 234, 27, 90, 12) },
  { region: 'thighs', shape: rect(83, 234, 27, 90, 12) },
  { region: null, shape: rect(52, 328, 23, 78, 10) },
  { region: null, shape: rect(85, 328, 23, 78, 10) },
];

const BACK: Part[] = [
  { region: 'head', shape: ellipse(80, 36, 21, 26) },
  { region: null, shape: rect(71, 60, 18, 14, 4) },
  { region: 'arms', shape: rect(24, 78, 18, 128, 9) },
  { region: 'arms', shape: rect(118, 78, 18, 128, 9) },
  { region: 'back', shape: rect(46, 72, 68, 124, 16) },
  { region: 'spine', shape: rect(75, 76, 10, 152, 5) },
  { region: 'hips', shape: rect(47, 198, 66, 34, 14) },
  { region: null, shape: rect(50, 234, 27, 90, 12) },
  { region: null, shape: rect(83, 234, 27, 90, 12) },
  { region: 'calves', shape: rect(52, 328, 23, 78, 10) },
  { region: 'calves', shape: rect(85, 328, 23, 78, 10) },
];

function fill(status: HealthStatus | undefined) {
  if (!status || status === 'unknown') return 'var(--mantine-color-gray-6)';
  return `var(--mantine-color-${statusColor[status]}-6)`;
}

export function BodyFigure({
  regions,
  selected,
  onSelect,
}: {
  regions: BodyRegionSummary[];
  selected: string | null;
  onSelect: (region: string) => void;
}) {
  const byRegion = new Map(regions.map((r) => [r.region, r]));

  const renderPart = (part: Part, i: number) => {
    const summary = part.region ? byRegion.get(part.region) : undefined;
    const hasData = !!summary && summary.findings.length > 0;
    const isSelected = part.region !== null && part.region === selected;
    const common = {
      fill: part.region ? fill(summary?.status) : 'var(--mantine-color-gray-6)',
      fillOpacity: hasData ? 0.85 : 0.18,
      stroke: isSelected ? 'var(--mantine-color-text)' : 'var(--mantine-color-default-border)',
      strokeWidth: isSelected ? 3 : 1,
      style: { cursor: part.region ? 'pointer' : 'default', transition: 'fill-opacity 150ms' },
      onClick: part.region ? () => onSelect(part.region!) : undefined,
      role: part.region ? 'button' : undefined,
      'aria-label': part.region ? REGION_LABELS[part.region] : undefined,
    };
    const s = part.shape;
    return s.kind === 'rect' ? (
      <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} {...common}>
        {part.region && <title>{REGION_LABELS[part.region]}</title>}
      </rect>
    ) : (
      <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common}>
        {part.region && <title>{REGION_LABELS[part.region]}</title>}
      </ellipse>
    );
  };

  return (
    <svg viewBox="0 0 360 440" width="100%" style={{ maxHeight: 420 }} role="img" aria-label="Mapa ciała">
      <g>{FRONT.map(renderPart)}</g>
      <g transform="translate(190 0)">{BACK.map(renderPart)}</g>
      <text x={80} y={432} textAnchor="middle" fontSize={13} fill="var(--mantine-color-dimmed)">
        Przód
      </text>
      <text x={270} y={432} textAnchor="middle" fontSize={13} fill="var(--mantine-color-dimmed)">
        Tył
      </text>
    </svg>
  );
}
