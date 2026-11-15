import { Badge, Divider, NavLink, Stack, Text } from '@mantine/core';
import {
  IconBell,
  IconChartLine,
  IconHeartbeat,
  IconMoodSmile,
  IconPlanet,
  type IconProps,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import type { Alert, HealthStatus, MetricGroup } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';
import { ALERTS_TAB } from './ProfileTabs';

/** Icon per group code; unknown (future) groups get a generic chart icon. */
const GROUP_ICONS: Record<string, ComponentType<IconProps>> = {
  environment: IconPlanet,
  physiology: IconHeartbeat,
  wellbeing: IconMoodSmile,
};

/**
 * Side navigation of a health profile: one entry per parameter group
 * (tab) with the group's worst status, plus the alerts list.
 */
export function ProfileSidebar({
  astronautName,
  groups,
  groupStatuses,
  alerts,
  active,
  onSelect,
}: {
  astronautName: string;
  groups: MetricGroup[];
  groupStatuses: Record<string, HealthStatus>;
  alerts: Alert[];
  active: string;
  onSelect: (tab: string) => void;
}) {
  const urgent = alerts.filter((a) => a.severity !== 'notice').length;
  return (
    <Stack gap={4} component="nav" aria-label="Zakładki profilu">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} px="sm" pt={4}>
        Profil zdrowotny
      </Text>
      <Text fw={700} px="sm" pb="xs" lineClamp={1}>
        {astronautName}
      </Text>
      {groups.map((g) => {
        const Icon = GROUP_ICONS[g.code] ?? IconChartLine;
        const status = groupStatuses[g.code] ?? 'unknown';
        return (
          <NavLink
            key={g.code}
            label={g.name}
            leftSection={<Icon size={20} />}
            rightSection={status !== 'unknown' ? <StatusBadge status={status} size="xs" /> : null}
            active={active === g.code}
            onClick={() => onSelect(g.code)}
            variant="light"
            component="button"
            style={{ borderRadius: 'var(--mantine-radius-md)', width: '100%' }}
          />
        );
      })}
      <Divider my="xs" />
      <NavLink
        label="Alerty"
        description={alerts.length ? 'Pełna lista ze szczegółami' : 'Brak alertów'}
        leftSection={<IconBell size={20} />}
        rightSection={
          alerts.length > 0 ? (
            <Badge size="sm" circle={alerts.length < 10} color={urgent > 0 ? 'red' : 'blue'}>
              {alerts.length}
            </Badge>
          ) : null
        }
        active={active === ALERTS_TAB}
        onClick={() => onSelect(ALERTS_TAB)}
        variant="light"
        component="button"
        style={{ borderRadius: 'var(--mantine-radius-md)', width: '100%' }}
      />
    </Stack>
  );
}
