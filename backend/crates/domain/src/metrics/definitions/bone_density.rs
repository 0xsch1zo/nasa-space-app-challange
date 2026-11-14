use crate::body::BodyRegion;
use crate::metrics::{Bounds, ChartKind, ComponentDefinition, DemoSignal, MetricDefinition};

/// Bone mineral density expressed as a T-score per skeletal site.
/// In microgravity weight-bearing bones lose ~1–1.5 % BMD per month.
pub fn definition() -> MetricDefinition {
    MetricDefinition::builder("bone_density", "Gęstość kości")
        .description(
            "Gęstość mineralna kości (T-score) w odcinku lędźwiowym i szyjce kości udowej.",
        )
        .chart(ChartKind::Line)
        .sampling_hours(24 * 7)
        .component(ComponentDefinition::new(
            "lumbar_spine",
            "Kręgosłup lędźwiowy",
            "T-score",
            BodyRegion::Spine,
            Bounds::between(-6.0, 5.0),
            Bounds::at_least(-1.0),
            Bounds::at_least(-2.5),
            2,
            DemoSignal {
                baseline: 0.4,
                spread: 0.45,
                drift_per_day: -0.0045,
                noise: 0.03,
            },
        ))
        .component(ComponentDefinition::new(
            "femoral_neck",
            "Szyjka kości udowej",
            "T-score",
            BodyRegion::Hips,
            Bounds::between(-6.0, 5.0),
            Bounds::at_least(-1.0),
            Bounds::at_least(-2.5),
            2,
            DemoSignal {
                baseline: 0.2,
                spread: 0.45,
                drift_per_day: -0.006,
                noise: 0.03,
            },
        ))
        .build()
}
