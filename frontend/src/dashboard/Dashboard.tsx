import { useMemo, useState } from 'react';
import { Grid, Group, SegmentedControl, Text } from '@mantine/core';
import type { MetricDefinition, Overview } from '../api/types';
import { buildDashboard } from './registry';
import type { DashboardContext, RangeKey } from './types';

export function Dashboard({
  astronautId,
  overview,
  catalog,
}: {
  astronautId: string;
  overview: Overview;
  catalog: MetricDefinition[];
}) {
  const [range, setRange] = useState<RangeKey>('90d');
  const widgets = useMemo(() => buildDashboard(catalog), [catalog]);
  const ctx: DashboardContext = { astronautId, overview, catalog, range };

  return (
    <>
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Parametry zdrowotne</Text>
        <SegmentedControl
          size="xs"
          value={range}
          onChange={(v) => setRange(v as RangeKey)}
          data={[
            { value: '30d', label: '30 dni' },
            { value: '90d', label: '90 dni' },
            { value: 'all', label: 'Cała misja' },
          ]}
        />
      </Group>
      <Grid gutter="md">
        {widgets.map(({ id, span, Component }) => (
          <Grid.Col key={id} span={{ base: 12, ...span }}>
            <Component ctx={ctx} />
          </Grid.Col>
        ))}
      </Grid>
    </>
  );
}
