import type { ComponentType } from 'react';
import type { MetricDefinition, MetricSnapshot, Overview } from '../api/types';

export type RangeKey = '30d' | '90d' | 'all';

/** Everything a widget may need. Widgets fetch anything else themselves. */
export interface DashboardContext {
  astronautId: string;
  overview: Overview;
  catalog: MetricDefinition[];
  range: RangeKey;
}

export interface GridSpan {
  base?: number;
  md?: number;
  lg?: number;
}

/** A self-contained dashboard module. */
export interface WidgetModule {
  id: string;
  span: GridSpan;
  Component: ComponentType<{ ctx: DashboardContext }>;
}

export interface MetricWidgetProps {
  ctx: DashboardContext;
  metric: MetricDefinition;
  snapshot: MetricSnapshot | undefined;
}

export type MetricWidgetComponent = ComponentType<MetricWidgetProps>;
