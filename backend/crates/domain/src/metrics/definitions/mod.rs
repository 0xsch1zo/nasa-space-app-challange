//! One file per health metric. Each exposes `pub fn definition() -> MetricDefinition`.

pub mod blood_pressure;
pub mod bone_density;
pub mod muscle_atrophy;
