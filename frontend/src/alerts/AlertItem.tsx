import { Group, Paper, Stack, Table, Text, UnstyledButton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import type { Alert } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';
import { fromNow } from '../lib/dates';
import { formatBounds, severityColor } from '../lib/status';
import { SeverityIcon } from './SeverityIcon';

/**
 * One alert. The whole row is a link to the full report of the parameter
 * (its tab, scrolled to its chart / body map).
 */
export function AlertItem({
  alert,
  groupName,
  onOpen,
  detailed = false,
}: {
  alert: Alert;
  groupName: string;
  onOpen: (alert: Alert) => void;
  detailed?: boolean;
}) {
  return (
    <Paper
      withBorder
      style={{ borderLeft: `4px solid var(--mantine-color-${severityColor[alert.severity]}-6)` }}
    >
      <UnstyledButton
        onClick={() => onOpen(alert)}
        p="sm"
        w="100%"
        aria-label={`${alert.title}: otwórz raport`}
      >
        <Group wrap="nowrap" gap="sm">
          <SeverityIcon severity={alert.severity} />
          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
            <Text fw={700} size="sm">
              {alert.title}
            </Text>
            <Text size="sm" c="dimmed">
              {alert.message}
            </Text>
          </Stack>
          <Stack gap={0} align="flex-end" visibleFrom="sm" style={{ flexShrink: 0 }}>
            <Text size="xs" c="dimmed">
              {groupName}
            </Text>
            {alert.recordedAt && (
              <Text size="xs" c="dimmed">
                {fromNow(alert.recordedAt)}
              </Text>
            )}
          </Stack>
          <IconChevronRight size={18} style={{ flexShrink: 0 }} />
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
