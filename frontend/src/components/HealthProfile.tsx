import { Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useAstronaut, useCatalog, useOverview } from '../api/hooks';
import { Dashboard } from '../dashboard/Dashboard';
import { fmtDate, fromNow } from '../lib/dates';
import { QueryState } from './QueryState';
import { StatusBadge } from './StatusBadge';

/** Full health profile of one astronaut: header + modular widget dashboard. */
export function HealthProfile({ astronautId }: { astronautId: string }) {
  const astronaut = useAstronaut(astronautId);
  const overview = useOverview(astronautId);
  const catalog = useCatalog();

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
                value={
                  astronaut.data.lastMeasurementAt ? fromNow(astronaut.data.lastMeasurementAt) : '—'
                }
              />
            </SimpleGrid>
          </Paper>
        )}
      </QueryState>

      <QueryState
        isLoading={overview.isLoading || catalog.isLoading}
        error={overview.error ?? catalog.error}
        minHeight={300}
      >
        {overview.data && catalog.data && (
          <Dashboard astronautId={astronautId} overview={overview.data} catalog={catalog.data} />
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
