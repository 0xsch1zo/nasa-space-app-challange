import { useState } from 'react';
import { Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import { useAlerts, useAstronaut, useCatalog, useGroups, useOverview } from '../api/hooks';
import type { Alert } from '../api/types';
import { AlertsBanner } from '../alerts/AlertsBanner';
import { ALERTS_TAB, ProfileTabs } from '../dashboard/ProfileTabs';
import type { Focus } from '../dashboard/types';
import { fmtDate, fromNow } from '../lib/dates';
import { QueryState } from './QueryState';
import { StatusBadge } from './StatusBadge';

/**
 * Full health profile of one astronaut (used by the astronaut view and by
 * supervisors): header, alerts, then tabs with the parameter groups.
 */
export function HealthProfile({ astronautId }: { astronautId: string }) {
  const astronaut = useAstronaut(astronautId);
  const overview = useOverview(astronautId);
  const catalog = useCatalog();
  const groups = useGroups();
  const alerts = useAlerts(astronautId);
  const [params, setParams] = useSearchParams();
  const [focus, setFocus] = useState<Focus | null>(null);

  const defaultTab = groups.data?.find((g) => g.default)?.code ?? groups.data?.[0]?.code ?? '';
  const tab = params.get('tab') ?? defaultTab;
  const setTab = (t: string) =>
    setParams(
      (p) => {
        p.set('tab', t);
        return p;
      },
      { replace: true },
    );

  function openAlert(a: Alert) {
    setTab(a.group);
    setFocus({ metric: a.metric, component: a.findings[0]?.component, nonce: Date.now() });
  }

  const loading = overview.isLoading || catalog.isLoading || groups.isLoading || alerts.isLoading;
  const error = overview.error ?? catalog.error ?? groups.error ?? alerts.error;

  return (
    <Stack gap="md">
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
          <>
            <AlertsBanner
              alerts={alerts.data}
              groups={groups.data}
              onOpenAlert={openAlert}
              onShowAll={() => setTab(ALERTS_TAB)}
            />
            <ProfileTabs
              astronautId={astronautId}
              overview={overview.data}
              catalog={catalog.data}
              groups={groups.data}
              alerts={alerts.data}
              tab={tab}
              onTabChange={(t) => {
                setFocus(null);
                setTab(t);
              }}
              focus={focus}
              onOpenAlert={openAlert}
            />
          </>
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
