//! Driving ports: the use cases offered to adapters (HTTP, device gateway, seeder).

use std::collections::BTreeMap;
use std::sync::Arc;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use domain::body::RegionSummary;
use domain::crew::{Astronaut, AstronautId, Station};
use domain::metrics::{Assessment, HealthStatus, MetricCatalog, MetricCode, Reading};

use super::outbound::{Bucket, IssuedToken, TimeRange};
use crate::error::AppResult;
use crate::security::Principal;

// ---------- authentication ----------

pub struct LoginResult {
    pub token: IssuedToken,
    pub principal: Principal,
}

#[async_trait]
pub trait AuthUseCase: Send + Sync {
    async fn login(&self, username: &str, password: &str) -> AppResult<LoginResult>;
    fn authenticate(&self, bearer_token: &str) -> AppResult<Principal>;
}

// ---------- crew ----------

#[derive(Debug, Clone)]
pub struct CrewMemberSummary {
    pub astronaut: Astronaut,
    pub station: Station,
    pub mission_day: i64,
    pub overall_status: HealthStatus,
    pub last_measurement_at: Option<DateTime<Utc>>,
    pub metric_statuses: Vec<(MetricCode, HealthStatus)>,
}

#[async_trait]
pub trait CrewUseCase: Send + Sync {
    /// Supervisors only: astronauts of the caller's station.
    async fn list_crew(&self, principal: &Principal) -> AppResult<Vec<CrewMemberSummary>>;
    async fn get_astronaut(
        &self,
        principal: &Principal,
        id: AstronautId,
    ) -> AppResult<CrewMemberSummary>;
}

// ---------- health data ----------

#[derive(Debug, Clone)]
pub struct MetricSnapshot {
    pub metric: MetricCode,
    pub latest: Option<Reading>,
    pub assessment: Option<Assessment>,
    pub stale: bool,
}

#[derive(Debug, Clone)]
pub struct HealthOverview {
    pub astronaut: Astronaut,
    pub overall_status: HealthStatus,
    pub metrics: Vec<MetricSnapshot>,
    pub body: Vec<RegionSummary>,
}

#[derive(Debug, Clone)]
pub struct SeriesQuery {
    pub astronaut: AstronautId,
    pub metric: String,
    pub range: TimeRange,
    pub bucket: Option<Bucket>,
}

#[derive(Debug, Clone)]
pub struct TimeSeries {
    pub metric: MetricCode,
    pub points: Vec<Reading>,
}

#[async_trait]
pub trait HealthUseCase: Send + Sync {
    fn catalog(&self) -> Arc<MetricCatalog>;
    async fn overview(&self, principal: &Principal, id: AstronautId) -> AppResult<HealthOverview>;
    async fn series(&self, principal: &Principal, query: SeriesQuery) -> AppResult<TimeSeries>;
}

// ---------- device ingestion ----------

/// A raw measurement as delivered by a medical device (or simulator/seeder).
#[derive(Debug, Clone)]
pub struct DeviceMeasurement {
    pub astronaut_id: AstronautId,
    pub metric: String,
    pub recorded_at: DateTime<Utc>,
    pub values: BTreeMap<String, f64>,
    /// Device identifier, e.g. `cuff-ISS-02`.
    pub source: String,
}

#[derive(Debug, Clone, Default)]
pub struct IngestReport {
    pub accepted: u64,
    /// `(index in batch, reason)`
    pub rejected: Vec<(usize, String)>,
}

/// Input port for medical device data. A real device gateway (MQTT, HL7/FHIR,
/// serial bridge …) would be a new driving adapter calling this port.
#[async_trait]
pub trait MeasurementIngestion: Send + Sync {
    async fn ingest(&self, batch: Vec<DeviceMeasurement>) -> AppResult<IngestReport>;
}
