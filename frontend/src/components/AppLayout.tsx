import {
  ActionIcon,
  AppShell,
  Badge,
  Group,
  Text,
  Title,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { IconLogout, IconMoon, IconSatellite, IconSun } from '@tabler/icons-react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function AppLayout() {
  const { user, logout } = useAuth();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <IconSatellite size={26} />
            <Title order={3}>AstroHealth</Title>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Text size="sm" visibleFrom="sm">
              {user?.displayName}
            </Text>
            <Badge
              variant="light"
              color={user?.role === 'supervisor' ? 'grape' : 'indigo'}
              style={{ flexShrink: 0, overflow: 'visible' }}
            >
              {user?.role === 'supervisor' ? 'Nadzór' : 'Astronauta'}
            </Badge>
            <Tooltip label="Zmień motyw">
              <ActionIcon variant="default" onClick={toggleColorScheme} aria-label="Zmień motyw">
                {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Wyloguj">
              <ActionIcon variant="default" onClick={logout} aria-label="Wyloguj">
                <IconLogout size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
