import type { MetricDefinition } from '../api/types';
import type { MetricWidgetComponent, WidgetModule } from './types';
import { attentionWidget } from './widgets/AttentionWidget';
import { bodyMapWidget } from './widgets/BodyMapWidget';
import { BloodPressureWidget } from './widgets/BloodPressureWidget';
import { MetricChartWidget } from './widgets/MetricChartWidget';

/**
 * Widget registry — the only place the dashboard learns what to render.
 *
 * 1. `profileWidgets`: cross-metric modules (body map, alerts). Reorder,
 *    remove or append modules here.
 * 2. Every metric in the backend catalog automatically gets a widget:
 *    the generic `MetricChartWidget`, unless a custom one is registered in
 *    `metricWidgetOverrides`. A NEW METRIC THEREFORE NEEDS NO FRONTEND CHANGE;
 *    a bespoke visualisation is one component + one line below.
 */
export const profileWidgets: WidgetModule[] = [bodyMapWidget, attentionWidget];

export const metricWidgetOverrides: Record<string, MetricWidgetComponent> = {
  blood_pressure: BloodPressureWidget,
};

export function metricWidget(metric: MetricDefinition): WidgetModule {
  const Widget = metricWidgetOverrides[metric.code] ?? MetricChartWidget;
  return {
    id: `metric:${metric.code}`,
    span: { base: 12, lg: 6 },
    Component: ({ ctx }) => (
      <Widget
        ctx={ctx}
        metric={metric}
        snapshot={ctx.overview.metrics.find((m) => m.code === metric.code)}
      />
    ),
  };
}

export function buildDashboard(catalog: MetricDefinition[]): WidgetModule[] {
  return [...profileWidgets, ...catalog.map(metricWidget)];
}
