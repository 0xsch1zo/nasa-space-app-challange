use std::sync::Arc;

use async_trait::async_trait;
use chrono::{Duration, Utc};
use domain::body::body_map;
use domain::crew::AstronautId;
use domain::metrics::{HealthStatus, MetricCatalog};

use super::Authorizer;
use crate::error::{AppError, AppResult};
use crate::ports::inbound::{
    HealthOverview, HealthUseCase, MetricSnapshot, SeriesQuery, TimeSeries,
};
use crate::ports::outbound::{CrewRepository, MeasurementRepository};
use crate::security::Principal;

pub struct HealthService {
    measurements: Arc<dyn MeasurementRepository>,
    catalog: Arc<MetricCatalog>,
    authorizer: Authorizer,
}

impl HealthService {
    pub fn new(
        crew: Arc<dyn CrewRepository>,
        measurements: Arc<dyn MeasurementRepository>,
        catalog: Arc<MetricCatalog>,
    ) -> Self {
        Self {
            measurements,
            catalog,
            authorizer: Authorizer::new(crew),
        }
    }
}

#[async_trait]
impl HealthUseCase for HealthService {
    fn catalog(&self) -> Arc<MetricCatalog> {
        self.catalog.clone()
    }

    async fn overview(&self, principal: &Principal, id: AstronautId) -> AppResult<HealthOverview> {
        let astronaut = self.authorizer.astronaut_visible_to(principal, id).await?;
        let latest = self.measurements.latest(id).await?;
        let now = Utc::now();

        let metrics: Vec<MetricSnapshot> = self
            .catalog
            .all()
            .iter()
            .map(|def| {
                let latest = latest
                    .iter()
                    .find(|(code, _)| code == &def.code)
                    .map(|(_, r)| r.clone());
                let assessment = latest.as_ref().map(|r| def.assess(r));
                let stale = latest.as_ref().is_none_or(|r| {
                    now - r.recorded_at
                        > Duration::hours(2 * i64::from(def.sampling_interval_hours))
                });
                MetricSnapshot {
                    metric: def.code.clone(),
                    latest,
                    assessment,
                    stale,
                }
            })
            .collect();
        let overall_status = metrics
            .iter()
            .filter_map(|m| m.assessment.as_ref().map(|a| a.status))
            .max()
            .unwrap_or(HealthStatus::Unknown);
        let body = body_map(&self.catalog, &latest);
        Ok(HealthOverview {
            astronaut,
            overall_status,
            metrics,
            body,
        })
    }

    async fn series(&self, principal: &Principal, query: SeriesQuery) -> AppResult<TimeSeries> {
        self.authorizer
            .astronaut_visible_to(principal, query.astronaut)
            .await?;
        let def = self.catalog.resolve(&query.metric)?;
        if let (Some(from), Some(to)) = (query.range.from, query.range.to) {
            if from > to {
                return Err(AppError::Validation("`from` must be before `to`".into()));
            }
        }
        let points = self
            .measurements
            .series(query.astronaut, &def.code, query.range, query.bucket)
            .await?;
        Ok(TimeSeries {
            metric: def.code.clone(),
            points,
        })
    }
}
