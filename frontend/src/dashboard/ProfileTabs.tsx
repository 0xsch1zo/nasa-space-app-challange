import { useEffect, useMemo, useState } from 'react';
import { Badge, Grid, Group, SegmentedControl, Tabs, Text } from '@mantine/core';
import { IconBell } from '@tabler/icons-react';
import type { Alert, MetricDefinition, MetricGroup, Overview } from '../api/types';
import { AlertsPanel } from '../alerts/AlertsPanel';
import { widgetsForGroup } from './registry';
import type { DashboardContext, Focus, RangeKey } from './types';

export const ALERTS_TAB = 'alerts';

/**
 * Health profile body: one tab per metric group (from the backend catalog)
 * plus a tab listing every alert.
 */
export function ProfileTabs({
  astronautId,
  overview,
  catalog,
  groups,
  alerts,
  tab,
  onTabChange,
  focus,
  onOpenAlert,
}: {
  astronautId: string;
  overview: Overview;
  catalog: MetricDefinition[];
  groups: MetricGroup[];
  alerts: Alert[];
  tab: string;
  onTabChange: (tab: string) => void;
  focus: Focus | null;
  onOpenAlert: (alert: Alert) => void;
}) {
  const [range, setRange] = useState<RangeKey>('90d');
  const ctx: DashboardContext = { astronautId, overview, catalog, range, focus };
  const urgent = alerts.filter((a) => a.severity !== 'notice').length;

  // Bring the alert's target into view once its tab has rendered.
  useEffect(() => {
    if (!focus) return;
    const id = requestAnimationFrame(() =>
      document.getElementById(`widget-${focus.metric}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
    return () => cancelAnimationFrame(id);
  }, [focus, tab]);

  return (
    <Tabs value={tab} onChange={(v) => v && onTabChange(v)} keepMounted={false} variant="outline">
      <Tabs.List mb="md">
        {groups.map((g) => (
          <Tabs.Tab key={g.code} value={g.code}>
            {g.name}
          </Tabs.Tab>
        ))}
        <Tabs.Tab
          value={ALERTS_TAB}
          leftSection={<IconBell size={16} />}
          rightSection={
            alerts.length > 0 ? (
              <Badge size="sm" circle={alerts.length < 10} color={urgent > 0 ? 'red' : 'blue'}>
                {alerts.length}
              </Badge>
            ) : null
          }
        >
          Alerty
        </Tabs.Tab>
      </Tabs.List>

      {groups.map((g) => (
        <Tabs.Panel key={g.code} value={g.code}>
          <GroupPanel group={g} ctx={ctx} onRangeChange={setRange} />
        </Tabs.Panel>
      ))}
      <Tabs.Panel value={ALERTS_TAB}>
        <AlertsPanel alerts={alerts} groups={groups} onOpenAlert={onOpenAlert} />
      </Tabs.Panel>
    </Tabs>
  );
}

function GroupPanel({
  group,
  ctx,
  onRangeChange,
}: {
  group: MetricGroup;
  ctx: DashboardContext;
  onRangeChange: (r: RangeKey) => void;
}) {
  const widgets = useMemo(() => widgetsForGroup(group.code, ctx.catalog), [group.code, ctx.catalog]);
  return (
    <>
      <Group justify="space-between" mb="sm" gap="xs">
        <Text size="sm" c="dimmed">
          {group.description}
        </Text>
        {widgets.some((w) => w.usesRange) && (
          <SegmentedControl
            size="xs"
            value={ctx.range}
            onChange={(v) => onRangeChange(v as RangeKey)}
            data={[
              { value: '30d', label: '30 dni' },
              { value: '90d', label: '90 dni' },
              { value: 'all', label: 'Cała misja' },
            ]}
          />
        )}
      </Group>
      <Grid gutter="md">
        {widgets.map(({ id, span, Component }) => {
          const focused = ctx.focus?.metric === id;
          return (
            <Grid.Col key={id} span={{ base: 12, ...span }}>
              <div
                id={`widget-${id}`}
                style={{
                  height: '100%',
                  scrollMarginTop: 76,
                  borderRadius: 'var(--mantine-radius-md)',
                  outline: focused ? '2px solid var(--mantine-primary-color-filled)' : 'none',
                  outlineOffset: 2,
                  transition: 'outline-color 300ms',
                }}
              >
                <Component ctx={ctx} />
              </div>
            </Grid.Col>
          );
        })}
      </Grid>
    </>
  );
}
