//! Mapping of health data onto the human body (for the body visualisation).

use std::collections::BTreeMap;

use crate::metrics::{HealthStatus, MetricCatalog, MetricCode, Reading};

/// Anatomical regions the UI can highlight. Each metric component declares
/// which region it belongs to; the body map is computed from that.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum BodyRegion {
    Head,
    Heart,
    Chest,
    Abdomen,
    Arms,
    Spine,
    Back,
    Hips,
    Thighs,
    Calves,
}

impl BodyRegion {
    pub const ALL: [BodyRegion; 10] = [
        BodyRegion::Head,
        BodyRegion::Heart,
        BodyRegion::Chest,
        BodyRegion::Abdomen,
        BodyRegion::Arms,
        BodyRegion::Spine,
        BodyRegion::Back,
        BodyRegion::Hips,
        BodyRegion::Thighs,
        BodyRegion::Calves,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            BodyRegion::Head => "head",
            BodyRegion::Heart => "heart",
            BodyRegion::Chest => "chest",
            BodyRegion::Abdomen => "abdomen",
            BodyRegion::Arms => "arms",
            BodyRegion::Spine => "spine",
            BodyRegion::Back => "back",
            BodyRegion::Hips => "hips",
            BodyRegion::Thighs => "thighs",
            BodyRegion::Calves => "calves",
        }
    }
}

/// One value shown on a body region.
#[derive(Debug, Clone, PartialEq)]
pub struct BodyFinding {
    pub metric: MetricCode,
    pub component: String,
    pub value: f64,
    pub status: HealthStatus,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RegionSummary {
    pub region: BodyRegion,
    pub status: HealthStatus,
    pub findings: Vec<BodyFinding>,
}

/// Projects the latest reading of every metric onto body regions.
/// Regions without data are reported as `Unknown`.
pub fn body_map(catalog: &MetricCatalog, latest: &[(MetricCode, Reading)]) -> Vec<RegionSummary> {
    let mut regions: BTreeMap<BodyRegion, Vec<BodyFinding>> = BTreeMap::new();
    for (code, reading) in latest {
        let Some(def) = catalog.get(code) else {
            continue;
        };
        for assessed in def.assess(reading).components {
            let Some(component) = def.component(&assessed.key) else {
                continue;
            };
            regions
                .entry(component.body_region)
                .or_default()
                .push(BodyFinding {
                    metric: code.clone(),
                    component: assessed.key,
                    value: assessed.value,
                    status: assessed.status,
                });
        }
    }
    BodyRegion::ALL
        .iter()
        .map(|&region| {
            let findings = regions.remove(&region).unwrap_or_default();
            let status = findings
                .iter()
                .map(|f| f.status)
                .max()
                .unwrap_or(HealthStatus::Unknown);
            RegionSummary {
                region,
                status,
                findings,
            }
        })
        .collect()
}
