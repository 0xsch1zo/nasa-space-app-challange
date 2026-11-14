import { Group, Paper, SimpleGrid, Table, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import type { CrewMember, HealthStatus, MetricDefinition } from '../api/types';
import { fromNow } from '../lib/dates';
import { statusColor, statusLabel, statusRank } from '../lib/status';
import { StatusBadge } from './StatusBadge';

/** Crew list for supervisors. Metric columns come from the catalog. */
export function CrewTable({
  crew,
  catalog,
  onOpen,
}: {
  crew: CrewMember[];
  catalog: MetricDefinition[];
  onOpen: (member: CrewMember) => void;
}) {
  const sorted = [...crew].sort(
    (a, b) => statusRank[b.overallStatus] - statusRank[a.overallStatus] || a.fullName.localeCompare(b.fullName),
  );
  const count = (s: HealthStatus) => crew.filter((c) => c.overallStatus === s).length;

  return (
    <>
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
        <SummaryCard label="Załoga" value={crew.length} color="indigo" />
        <SummaryCard label={statusLabel.normal} value={count('normal')} color={statusColor.normal} />
        <SummaryCard label={statusLabel.warning} value={count('warning')} color={statusColor.warning} />
        <SummaryCard label={statusLabel.critical} value={count('critical')} color={statusColor.critical} />
      </SimpleGrid>

      <Paper withBorder>
        <Table.ScrollContainer minWidth={760}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Astronauta</Table.Th>
                <Table.Th>Dzień misji</Table.Th>
                {catalog.map((m) => (
                  <Table.Th key={m.code}>{m.name}</Table.Th>
                ))}
                <Table.Th>Stan ogólny</Table.Th>
                <Table.Th>Ostatni pomiar</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sorted.map((c) => (
                <Table.Tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(c)}>
                  <Table.Td>
                    <UnstyledButton onClick={() => onOpen(c)}>
                      <Text fw={600}>{c.fullName}</Text>
                      <Text size="xs" c="dimmed">
                        {c.specialty} · {c.agency}
                      </Text>
                    </UnstyledButton>
                  </Table.Td>
                  <Table.Td>{c.missionDay}</Table.Td>
                  {catalog.map((m) => (
                    <Table.Td key={m.code}>
                      <StatusBadge status={c.metricStatuses[m.code] ?? 'unknown'} size="sm" />
                    </Table.Td>
                  ))}
                  <Table.Td>
                    <StatusBadge status={c.overallStatus} variant="filled" />
                  </Table.Td>
                  <Table.Td>
                    {c.lastMeasurementAt ? (
                      <Tooltip label={new Date(c.lastMeasurementAt).toLocaleString('pl-PL')}>
                        <Text size="sm">{fromNow(c.lastMeasurementAt)}</Text>
                      </Tooltip>
                    ) : (
                      '—'
                    )}
                  </Table.Td>
                  <Table.Td>
                    <IconChevronRight size={16} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Paper withBorder p="md" style={{ borderLeft: `4px solid var(--mantine-color-${color}-6)` }}>
      <Group justify="space-between">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          {label}
        </Text>
      </Group>
      <Text fw={700} fz={28}>
        {value}
      </Text>
    </Paper>
  );
}
