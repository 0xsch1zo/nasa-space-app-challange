use crate::body::BodyRegion;
use crate::metrics::{Bounds, ChartKind, ComponentDefinition, DemoSignal, MetricDefinition};

/// Muscle volume change vs. the pre-flight baseline (ultrasound / MRI), in %.
/// Postural muscles (calf, back) atrophy fastest without countermeasures.
pub fn definition() -> MetricDefinition {
    MetricDefinition::builder("muscle_atrophy", "Zanik mięśni")
        .description("Zmiana objętości mięśni względem pomiaru przed lotem.")
        .chart(ChartKind::Area)
        .sampling_hours(24 * 7)
        .component(ComponentDefinition::new(
            "quadriceps",
            "Mięsień czworogłowy uda",
            "%",
            BodyRegion::Thighs,
            Bounds::between(-60.0, 25.0),
            Bounds::at_least(-5.0),
            Bounds::at_least(-10.0),
            1,
            DemoSignal {
                baseline: 0.0,
                spread: 0.6,
                drift_per_day: -0.03,
                noise: 0.5,
            },
        ))
        .component(ComponentDefinition::new(
            "triceps_surae",
            "Mięśnie łydki",
            "%",
            BodyRegion::Calves,
            Bounds::between(-60.0, 25.0),
            Bounds::at_least(-5.0),
            Bounds::at_least(-10.0),
            1,
            DemoSignal {
                baseline: 0.0,
                spread: 0.6,
                drift_per_day: -0.045,
                noise: 0.5,
            },
        ))
        .component(ComponentDefinition::new(
            "erector_spinae",
            "Prostownik grzbietu",
            "%",
            BodyRegion::Back,
            Bounds::between(-60.0, 25.0),
            Bounds::at_least(-5.0),
            Bounds::at_least(-10.0),
            1,
            DemoSignal {
                baseline: 0.0,
                spread: 0.6,
                drift_per_day: -0.035,
                noise: 0.5,
            },
        ))
        .build()
}
