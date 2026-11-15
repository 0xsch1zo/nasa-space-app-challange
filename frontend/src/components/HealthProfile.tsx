import { useMemo, useState } from 'react';
import { Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import { useAlerts, useAstronaut, useCatalog, useGroups, useOverview } from '../api/hooks';
import type { Alert, HealthStatus } from '../api/types';
import { AlertsBanner } from '../alerts/AlertsBanner';
import { ProfileSidebar } from '../dashboard/ProfileSidebar';
import { ALERTS_TAB, ProfileTabs } from '../dashboard/ProfileTabs';
import type { Focus } from '../dashboard/types';
import { fmtDate, fromNow } from '../lib/dates';
import { worstStatus } from '../lib/status';
import { QueryState } from './QueryState';
import { Sidebar, useSidebar } from './SidebarContext';
import { StatusBadge } from './StatusBadge';

/**
 * Full health profile of one astronaut (used by the astronaut view and by
 * supervisors). Layout:
 *   - side bar: one entry per parameter group (tab) + alerts,
 *   - top of the panel, above everything and independent of the tab:
 *     full-width alert banners (or the green all-clear bar),
 *   - astronaut header, then the selected tab's panel.
 */
export function HealthProfile({ astronautId }: { astronautId: string }) {
  const astronaut = useAstronaut(astronautId);
  const overview = useOverview(astronautId);
  const catalog = useCatalog();
  const groups = useGroups();
  const alerts = useAlerts(astronautId);
  const sidebar = useSidebar();
  const [params, setParams] = useSearchParams();
  const [focus, setFocus] = useState<Focus | null>(null);

  const defaultTab = groups.data?.find((g) => g.default)?.code ?? groups.data?.[0]?.code ?? '';
  const tab = params.get('tab') ?? defaultTab;
  const setTab = (t: string) => {
    sidebar.close();
    setParams(
      (p) => {
        p.set('tab', t);
        return p;
      },
      { replace: true },
    );
  };

  function openAlert(a: Alert) {
    setTab(a.group);
    setFocus({ metric: a.metric, component: a.findings[0]?.component, nonce: Date.now() });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Worst status per group, for the side bar.
  const groupStatuses = useMemo(() => {
    const out: Record<string, HealthStatus> = {};
    for (const g of groups.data ?? []) {
      const codes = (catalog.data ?? []).filter((m) => m.group === g.code).map((m) => m.code);
      out[g.code] = worstStatus(
        (overview.data?.metrics ?? []).filter((m) => codes.includes(m.code)).map((m) => m.status),
      );
    }
    return out;
  }, [groups.data, catalog.data, overview.data]);

  const loading = overview.isLoading || catalog.isLoading || groups.isLoading || alerts.isLoading;
  const error = overview.error ?? catalog.error ?? groups.error ?? alerts.error;

  return (
    <Stack gap="md">
      {groups.data && alerts.data && (
        <Sidebar>
          <ProfileSidebar
            astronautName={astronaut.data?.fullName ?? '…'}
            groups={groups.data}
            groupStatuses={groupStatuses}
            alerts={alerts.data}
            active={tab}
            onSelect={(t) => {
              setFocus(null);
              setTab(t);
            }}
          />
        </Sidebar>
      )}

      {alerts.data && groups.data && (
        <AlertsBanner
          alerts={alerts.data}
          groups={groups.data}
          onOpenAlert={openAlert}
          onShowAll={() => setTab(ALERTS_TAB)}
        />
      )}

      <QueryState isLoading={astronaut.isLoading} error={astronaut.error} minHeight={60}>
        {astronaut.data && (
          <Paper withBorder p="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={2}>{astronaut.data.fullName}</Title>
                <Text c="dimmed">
                  {astronaut.data.specialty} · {astronaut.data.agency} · {astronaut.data.stationName}
                </Text>
              </div>
              <StatusBadge status={astronaut.data.overallStatus} size="lg" />
            </Group>
            <SimpleGrid cols={{ base: 2, sm: 3 }} mt="md">
              <Stat label="Dzień misji" value={String(astronaut.data.missionDay)} />
              <Stat label="Start misji" value={fmtDate(astronaut.data.missionStart)} />
              <Stat
                label="Ostatni pomiar"
                value={astronaut.data.lastMeasurementAt ? fromNow(astronaut.data.lastMeasurementAt) : '—'}
              />
            </SimpleGrid>
          </Paper>
        )}
      </QueryState>

      <QueryState isLoading={loading} error={error} minHeight={300}>
        {overview.data && catalog.data && groups.data && alerts.data && (
          <ProfileTabs
            astronautId={astronautId}
            overview={overview.data}
            catalog={catalog.data}
            groups={groups.data}
            alerts={alerts.data}
            tab={tab}
            focus={focus}
            onOpenAlert={openAlert}
          />
        )}
      </QueryState>
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text fw={600} size="lg">
        {value}
      </Text>
    </div>
  );
}
