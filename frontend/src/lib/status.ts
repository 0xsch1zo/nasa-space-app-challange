import type { Bounds, HealthStatus, MetricComponent } from '../api/types';

export const statusColor: Record<HealthStatus, string> = {
  unknown: 'gray',
  normal: 'teal',
  warning: 'yellow',
  critical: 'red',
};

export const statusLabel: Record<HealthStatus, string> = {
  unknown: 'Brak danych',
  normal: 'W normie',
  warning: 'Ostrzeżenie',
  critical: 'Krytyczny',
};

export const statusRank: Record<HealthStatus, number> = {
  unknown: 0,
  normal: 1,
  warning: 2,
  critical: 3,
};

export function formatValue(value: number | undefined, c: MetricComponent) {
  if (value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(c.decimals)} ${c.unit}`;
}

export function formatBounds(b: Bounds, unit: string) {
  if (b.min !== null && b.max !== null) return `${b.min}–${b.max} ${unit}`;
  if (b.min !== null) return `≥ ${b.min} ${unit}`;
  if (b.max !== null) return `≤ ${b.max} ${unit}`;
  return 'dowolna';
}
