use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use domain::crew::AstronautId;
use domain::metrics::{MetricCatalog, MetricHistory, Reading};

use crate::error::AppResult;
use crate::ports::inbound::{DeviceMeasurement, IngestReport, MeasurementIngestion};
use crate::ports::outbound::{CrewRepository, MeasurementRepository};

/// Validates device measurements against the metric catalog and appends them
/// to the history aggregates. Invalid items are reported, not fatal.
pub struct IngestionService {
    crew: Arc<dyn CrewRepository>,
    measurements: Arc<dyn MeasurementRepository>,
    catalog: Arc<MetricCatalog>,
}

impl IngestionService {
    pub fn new(
        crew: Arc<dyn CrewRepository>,
        measurements: Arc<dyn MeasurementRepository>,
        catalog: Arc<MetricCatalog>,
    ) -> Self {
        Self {
            crew,
            measurements,
            catalog,
        }
    }
}

#[async_trait]
impl MeasurementIngestion for IngestionService {
    async fn ingest(&self, batch: Vec<DeviceMeasurement>) -> AppResult<IngestReport> {
        let mut report = IngestReport::default();
        let mut known: HashMap<AstronautId, bool> = HashMap::new();
        let mut accepted = Vec::with_capacity(batch.len());

        for (idx, m) in batch.into_iter().enumerate() {
            let exists = match known.get(&m.astronaut_id) {
                Some(e) => *e,
                None => {
                    let e = self.crew.find_astronaut(m.astronaut_id).await?.is_some();
                    known.insert(m.astronaut_id, e);
                    e
                }
            };
            if !exists {
                report
                    .rejected
                    .push((idx, format!("unknown astronaut {}", m.astronaut_id)));
                continue;
            }
            let recorded = self.catalog.resolve(&m.metric).and_then(|def| {
                MetricHistory::record(
                    def,
                    m.astronaut_id,
                    Reading {
                        recorded_at: m.recorded_at,
                        values: m.values,
                    },
                    m.source,
                )
            });
            match recorded {
                Ok(r) => accepted.push(r),
                Err(e) => report.rejected.push((idx, e.to_string())),
            }
        }
        if !accepted.is_empty() {
            report.accepted = self.measurements.append(&accepted).await?;
        }
        Ok(report)
    }
}
