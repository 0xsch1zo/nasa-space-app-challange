import { Group, Paper, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { IconChevronRight, IconCircleCheck } from '@tabler/icons-react';
import type { Alert, MetricGroup } from '../api/types';
import { AlertItem } from './AlertItem';

export const BANNER_LIMIT = 3;

/**
 * Top of the astronaut panel, above the content of whichever tab is open:
 * full-width banners with the most important alerts (already sorted by the
 * backend), a green "all good" bar when nothing is critical or a warning,
 * and a link to the full list when there are more than three.
 */
export function AlertsBanner({
  alerts,
  groups,
  onOpenAlert,
  onShowAll,
}: {
  alerts: Alert[];
  groups: MetricGroup[];
  onOpenAlert: (alert: Alert) => void;
  onShowAll: () => void;
}) {
  const urgent = alerts.some((a) => a.severity !== 'notice');
  const shown = alerts.slice(0, BANNER_LIMIT);
  const hidden = alerts.length - shown.length;
  const groupName = (code: string) => groups.find((g) => g.code === code)?.name ?? code;

  return (
    <Stack gap="xs" aria-label="Alerty zdrowotne" component="section">
      {!urgent && (
        <Paper
          p="md"
          radius="md"
          bg="var(--mantine-color-teal-light)"
          style={{ border: '1px solid var(--mantine-color-teal-outline)' }}
        >
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon color="teal" radius="xl" size={44}>
              <IconCircleCheck size={28} />
            </ThemeIcon>
            <div>
              <Text fw={800} size="lg" c="teal">
                Wszystkie parametry w normie
              </Text>
              <Text size="sm" c="dimmed">
                Brak alertów krytycznych i ostrzeżeń.
                {alerts.length > 0 &&
                  ` ${alerts.length} ${alerts.length === 1 ? 'uwaga organizacyjna' : 'uwagi organizacyjne'} poniżej.`}
              </Text>
            </div>
          </Group>
        </Paper>
      )}
      {shown.map((a) => (
        <AlertItem key={a.id} alert={a} groupName={groupName(a.group)} onOpen={onOpenAlert} size="lg" />
      ))}
      {hidden > 0 && (
        <UnstyledButton onClick={onShowAll} aria-label="Pokaż wszystkie alerty">
          <Paper
            p="sm"
            radius="md"
            style={{ border: '2px dashed var(--mantine-color-default-border)' }}
          >
            <Group justify="center" gap={6}>
              <Text fw={700}>
                + {hidden} {hidden === 1 ? 'kolejny alert' : hidden < 5 ? 'kolejne alerty' : 'kolejnych alertów'}
              </Text>
              <Text size="sm" c="dimmed">
                · zobacz wszystkie
              </Text>
              <IconChevronRight size={16} />
            </Group>
          </Paper>
        </UnstyledButton>
      )}
    </Stack>
  );
}
