// Mirrors the backend JSON contracts (adapter-http/src/dto.rs).
// Nothing here is metric-specific: metrics are described at runtime by the catalog.

export type Role = 'astronaut' | 'supervisor';
export type HealthStatus = 'unknown' | 'normal' | 'warning' | 'critical';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  stationId: string;
  astronautId: string | null;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: User;
}

export interface Bounds {
  min: number | null;
  max: number | null;
}

export interface MetricComponent {
  key: string;
  label: string;
  unit: string;
  bodyRegion: string;
  decimals: number;
  reference: { normal: Bounds; warning: Bounds };
}

export interface MetricDefinition {
  code: string;
  name: string;
  description: string;
  chart: 'line' | 'area' | 'bar';
  samplingIntervalHours: number;
  components: MetricComponent[];
}

export interface Astronaut {
  id: string;
  fullName: string;
  agency: string;
  specialty: string;
  missionStart: string;
  stationId: string;
}

export interface CrewMember extends Astronaut {
  stationName: string;
  missionDay: number;
  overallStatus: HealthStatus;
  lastMeasurementAt: string | null;
  metricStatuses: Record<string, HealthStatus>;
}

export interface MetricSnapshot {
  code: string;
  recordedAt: string | null;
  values: Record<string, number>;
  status: HealthStatus;
  componentStatuses: Record<string, HealthStatus>;
  stale: boolean;
}

export interface BodyFinding {
  metric: string;
  component: string;
  value: number;
  status: HealthStatus;
}

export interface BodyRegionSummary {
  region: string;
  status: HealthStatus;
  findings: BodyFinding[];
}

export interface Overview {
  astronaut: Astronaut;
  overallStatus: HealthStatus;
  metrics: MetricSnapshot[];
  body: BodyRegionSummary[];
}

export interface SeriesPoint {
  t: string;
  values: Record<string, number>;
}

export interface Series {
  metric: string;
  points: SeriesPoint[];
}
