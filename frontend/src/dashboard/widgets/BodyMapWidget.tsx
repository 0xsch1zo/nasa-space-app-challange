import { useState } from 'react';
import { Badge, Grid, Group, Stack, Text } from '@mantine/core';
import { StatusBadge } from '../../components/StatusBadge';
import { formatValue, statusColor, statusLabel, statusRank } from '../../lib/status';
import type { HealthStatus } from '../../api/types';
import type { DashboardContext, WidgetModule } from '../types';
import { WidgetCard } from '../WidgetCard';
import { BodyFigure, REGION_LABELS } from './BodyFigure';

/**
 * 2D body map. Region colours come from the backend body map, which is
 * derived from each metric component's `bodyRegion` — a new metric shows up
 * here automatically.
 */
function BodyMapWidget({ ctx }: { ctx: DashboardContext }) {
  const regions = ctx.overview.body;
  const worst = [...regions]
    .filter((r) => r.findings.length > 0)
    .sort((a, b) => statusRank[b.status] - statusRank[a.status])[0];
  const [selected, setSelected] = useState<string | null>(worst?.region ?? null);
  const current = regions.find((r) => r.region === selected);

  return (
    <WidgetCard title="Mapa ciała" subtitle="Najnowsze wartości przypisane do części ciała">
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <BodyFigure regions={regions} selected={selected} onSelect={setSelected} />
          <Group gap={6} justify="center" mt="xs">
            {(['normal', 'warning', 'critical', 'unknown'] as HealthStatus[]).map((s) => (
              <Badge key={s} size="xs" variant="dot" color={statusColor[s]}>
                {statusLabel[s]}
              </Badge>
            ))}
          </Group>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          {current ? (
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={700}>{REGION_LABELS[current.region] ?? current.region}</Text>
                <StatusBadge status={current.status} />
              </Group>
              {current.findings.length === 0 && (
                <Text c="dimmed" size="sm">
                  Brak parametrów monitorowanych dla tej części ciała.
                </Text>
              )}
              {current.findings.map((f) => {
                const metric = ctx.catalog.find((m) => m.code === f.metric);
                const component = metric?.components.find((c) => c.key === f.component);
                return (
                  <Group key={`${f.metric}.${f.component}`} justify="space-between" wrap="nowrap">
                    <div>
                      <Text size="sm" fw={600}>
                        {component?.label ?? f.component}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {metric?.name ?? f.metric}
                      </Text>
                    </div>
                    <Text fw={700} c={`${statusColor[f.status]}.5`}>
                      {component ? formatValue(f.value, component) : f.value}
                    </Text>
                  </Group>
                );
              })}
            </Stack>
          ) : (
            <Text c="dimmed" size="sm">
              Kliknij część ciała, aby zobaczyć szczegóły.
            </Text>
          )}
        </Grid.Col>
      </Grid>
    </WidgetCard>
  );
}

export const bodyMapWidget: WidgetModule = {
  id: 'body-map',
  span: { base: 12, lg: 6 },
  Component: BodyMapWidget,
};
