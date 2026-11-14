import { Stack, Table, Text, ThemeIcon, Group } from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';
import { StatusBadge } from '../../components/StatusBadge';
import { formatBounds, formatValue, statusRank } from '../../lib/status';
import type { DashboardContext, WidgetModule } from '../types';
import { WidgetCard } from '../WidgetCard';

/** Cross-metric list of components outside their normal range. */
function AttentionWidget({ ctx }: { ctx: DashboardContext }) {
  const rows = ctx.catalog
    .flatMap((metric) => {
      const snap = ctx.overview.metrics.find((m) => m.code === metric.code);
      return metric.components.map((c) => ({
        metric,
        component: c,
        value: snap?.values[c.key],
        status: snap?.componentStatuses[c.key] ?? 'unknown',
      }));
    })
    .filter((r) => r.status === 'warning' || r.status === 'critical')
    .sort((a, b) => statusRank[b.status] - statusRank[a.status]);

  return (
    <WidgetCard title="Wymaga uwagi" subtitle="Parametry poza zakresem referencyjnym">
      {rows.length === 0 ? (
        <Stack align="center" py="xl" gap="xs">
          <ThemeIcon color="teal" variant="light" size={48} radius="xl">
            <IconCircleCheck size={28} />
          </ThemeIcon>
          <Text c="dimmed">Wszystkie parametry w normie</Text>
        </Stack>
      ) : (
        <Table verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Parametr</Table.Th>
              <Table.Th>Wartość</Table.Th>
              <Table.Th>Norma</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={`${r.metric.code}.${r.component.key}`}>
                <Table.Td>
                  <Text size="sm" fw={600}>
                    {r.component.label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {r.metric.name}
                  </Text>
                </Table.Td>
                <Table.Td>{formatValue(r.value, r.component)}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Text size="sm" c="dimmed">
                      {formatBounds(r.component.reference.normal, r.component.unit)}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <StatusBadge status={r.status} size="sm" />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </WidgetCard>
  );
}

export const attentionWidget: WidgetModule = {
  id: 'attention',
  span: { base: 12, lg: 6 },
  Component: AttentionWidget,
};
