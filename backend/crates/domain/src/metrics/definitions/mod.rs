//! One file per health metric. Each exposes `pub fn definition() -> MetricDefinition`.

pub mod blood_pressure;
pub mod bone_density;
pub mod heart_rate;
pub mod muscle_atrophy;
