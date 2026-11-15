import { Badge, Group, Paper, Stack, Table, Text, UnstyledButton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import type { Alert } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';
import { fromNow } from '../lib/dates';
import { formatBounds, severityColor, severityLabel } from '../lib/status';
import { SeverityIcon } from './SeverityIcon';

/**
 * One alert. The whole row is a link to the full report of the parameter
 * (its tab, scrolled to its chart / lab table / body map).
 *
 * `size="lg"` is the full-width banner at the top of a profile; `"md"` is
 * the compact row used in the alerts list.
 */
export function AlertItem({
  alert,
  groupName,
  onOpen,
  detailed = false,
  size = 'md',
}: {
  alert: Alert;
  groupName: string;
  onOpen: (alert: Alert) => void;
  detailed?: boolean;
  size?: 'md' | 'lg';
}) {
  const lg = size === 'lg';
  const color = severityColor[alert.severity];
  return (
    <Paper
      withBorder
      radius="md"
      bg={lg ? `var(--mantine-color-${color}-light)` : undefined}
      style={{ borderLeft: `6px solid var(--mantine-color-${color}-6)` }}
    >
      <UnstyledButton
        onClick={() => onOpen(alert)}
        p={lg ? 'md' : 'sm'}
        w="100%"
        aria-label={`${alert.title}: otwórz raport`}
      >
        <Group wrap="nowrap" gap={lg ? 'md' : 'sm'}>
          <SeverityIcon severity={alert.severity} size={lg ? 44 : 34} />
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" wrap="nowrap">
              <Badge color={color} variant={alert.severity === 'notice' ? 'light' : 'filled'} size={lg ? 'md' : 'sm'}>
                {severityLabel[alert.severity]}
              </Badge>
              <Text fw={800} size={lg ? 'lg' : 'sm'} lineClamp={1}>
                {alert.title}
              </Text>
            </Group>
            <Text size={lg ? 'md' : 'sm'} c={lg ? undefined : 'dimmed'}>
              {alert.message}
            </Text>
          </Stack>
          <Stack gap={2} align="flex-end" visibleFrom="sm" style={{ flexShrink: 0 }}>
            <Text size="sm" fw={600} c={`${color}.5`}>
              Zobacz raport: {groupName}
            </Text>
            {alert.recordedAt && (
              <Text size="xs" c="dimmed">
                pomiar {fromNow(alert.recordedAt)}
              </Text>
            )}
          </Stack>
          <IconChevronRight size={lg ? 22 : 18} style={{ flexShrink: 0 }} />
        </Group>
      </UnstyledButton>
      {detailed && alert.findings.length > 0 && (
        <Table fz="sm" verticalSpacing={4} px="sm" pb="xs" withRowBorders={false} layout="fixed">
          <Table.Tbody>
            {alert.findings.map((f) => (
              <Table.Tr key={f.component}>
                <Table.Td pl={58} w="40%">
                  {f.label}
                </Table.Td>
                <Table.Td fw={600}>
                  {f.value} {f.unit}
                </Table.Td>
                <Table.Td c="dimmed">norma {formatBounds(f.normal, f.unit)}</Table.Td>
                <Table.Td>
                  <StatusBadge status={f.status} size="sm" />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}
