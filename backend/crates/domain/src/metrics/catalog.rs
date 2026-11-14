use super::definition::{MetricCode, MetricDefinition};
use super::definitions;
use crate::error::DomainError;

/// Registry of all known health metrics, in display order.
#[derive(Debug, Clone)]
pub struct MetricCatalog {
    metrics: Vec<MetricDefinition>,
}

impl MetricCatalog {
    /// The built-in metrics. **To add a health parameter, create a file in
    /// `metrics/definitions/` and add one line here.**
    pub fn builtin() -> Self {
        Self::new(vec![
            definitions::blood_pressure::definition(),
            definitions::bone_density::definition(),
            definitions::muscle_atrophy::definition(),
        ])
    }

    pub fn new(metrics: Vec<MetricDefinition>) -> Self {
        let mut seen = std::collections::HashSet::new();
        for m in &metrics {
            assert!(seen.insert(m.code.clone()), "duplicate metric `{}`", m.code);
        }
        Self { metrics }
    }

    pub fn all(&self) -> &[MetricDefinition] {
        &self.metrics
    }

    pub fn get(&self, code: &MetricCode) -> Option<&MetricDefinition> {
        self.metrics.iter().find(|m| &m.code == code)
    }

    pub fn get_str(&self, code: &str) -> Option<&MetricDefinition> {
        self.metrics.iter().find(|m| m.code.as_str() == code)
    }

    pub fn resolve(&self, code: &str) -> Result<&MetricDefinition, DomainError> {
        self.get_str(code)
            .ok_or_else(|| DomainError::UnknownMetric(code.to_owned()))
    }
}
