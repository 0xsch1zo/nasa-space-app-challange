use crate::body::BodyRegion;
use crate::error::DomainError;

/// Stable identifier of a health metric, e.g. `blood_pressure`.
///
/// Restricted to `[a-z0-9_]` so that it is safe to use in URLs and as a
/// storage identifier (each metric gets its own table partition).
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct MetricCode(String);

impl MetricCode {
    pub fn new(code: impl Into<String>) -> Result<Self, DomainError> {
        let code = code.into();
        let valid = !code.is_empty()
            && code.len() <= 48
            && code.starts_with(|c: char| c.is_ascii_lowercase())
            && code
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_');
        if valid {
            Ok(Self(code))
        } else {
            Err(DomainError::InvalidMetricCode(code))
        }
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for MetricCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

/// Health classification of a value. Ordered from best to worst so that
/// `max()` yields the worst status of a set.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum HealthStatus {
    Unknown,
    Normal,
    Warning,
    Critical,
}

impl HealthStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            HealthStatus::Unknown => "unknown",
            HealthStatus::Normal => "normal",
            HealthStatus::Warning => "warning",
            HealthStatus::Critical => "critical",
        }
    }
}

/// Half-open interval helper; `None` means unbounded on that side.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Bounds {
    pub min: Option<f64>,
    pub max: Option<f64>,
}

impl Bounds {
    pub const fn new(min: Option<f64>, max: Option<f64>) -> Self {
        Self { min, max }
    }
    pub const fn between(min: f64, max: f64) -> Self {
        Self::new(Some(min), Some(max))
    }
    pub const fn at_least(min: f64) -> Self {
        Self::new(Some(min), None)
    }
    pub const fn at_most(max: f64) -> Self {
        Self::new(None, Some(max))
    }

    pub fn contains(&self, v: f64) -> bool {
        self.min.is_none_or(|m| v >= m) && self.max.is_none_or(|m| v <= m)
    }
}

/// Clinical reference: inside `normal` → Normal, inside `warning` → Warning,
/// otherwise Critical.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ReferenceRange {
    pub normal: Bounds,
    pub warning: Bounds,
}

impl ReferenceRange {
    pub fn classify(&self, value: f64) -> HealthStatus {
        if self.normal.contains(value) {
            HealthStatus::Normal
        } else if self.warning.contains(value) {
            HealthStatus::Warning
        } else {
            HealthStatus::Critical
        }
    }
}

/// Suggested visualisation. The frontend picks a default widget from this,
/// unless a custom widget is registered for the metric code.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChartKind {
    Line,
    Area,
    Bar,
}

impl ChartKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ChartKind::Line => "line",
            ChartKind::Area => "area",
            ChartKind::Bar => "bar",
        }
    }
}

/// Parameters of a synthetic signal used *only* by the demo seeder:
/// `value = baseline + N(0, spread) per astronaut + drift_per_day * day * risk + N(0, noise)`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DemoSignal {
    pub baseline: f64,
    pub spread: f64,
    pub drift_per_day: f64,
    pub noise: f64,
}

/// One measured quantity of a metric (blood pressure has two: systolic and
/// diastolic; bone density has one per skeletal site).
#[derive(Debug, Clone, PartialEq)]
pub struct ComponentDefinition {
    pub key: String,
    pub label: String,
    pub unit: String,
    /// Where on the body this value is shown.
    pub body_region: BodyRegion,
    /// Physically plausible range; values outside are rejected as device errors.
    pub plausible: Bounds,
    pub reference: ReferenceRange,
    pub decimals: u8,
    pub demo: DemoSignal,
}

#[derive(Debug, Clone, PartialEq)]
pub struct MetricDefinition {
    pub code: MetricCode,
    pub name: String,
    pub description: String,
    pub chart: ChartKind,
    /// How often devices are expected to report (hours). Used for the demo
    /// seed and to flag stale data in the UI.
    pub sampling_interval_hours: u32,
    pub components: Vec<ComponentDefinition>,
}

impl MetricDefinition {
    pub fn component(&self, key: &str) -> Option<&ComponentDefinition> {
        self.components.iter().find(|c| c.key == key)
    }
}

/// Small builder so metric files stay short and readable.
pub struct MetricBuilder {
    def: MetricDefinition,
}

impl MetricDefinition {
    pub fn builder(code: &str, name: &str) -> MetricBuilder {
        MetricBuilder {
            def: MetricDefinition {
                code: MetricCode::new(code).expect("builtin metric code must be valid"),
                name: name.to_owned(),
                description: String::new(),
                chart: ChartKind::Line,
                sampling_interval_hours: 24,
                components: Vec::new(),
            },
        }
    }
}

impl MetricBuilder {
    pub fn description(mut self, d: &str) -> Self {
        self.def.description = d.to_owned();
        self
    }
    pub fn chart(mut self, c: ChartKind) -> Self {
        self.def.chart = c;
        self
    }
    pub fn sampling_hours(mut self, h: u32) -> Self {
        self.def.sampling_interval_hours = h;
        self
    }
    pub fn component(mut self, c: ComponentDefinition) -> Self {
        self.def.components.push(c);
        self
    }
    pub fn build(self) -> MetricDefinition {
        assert!(
            !self.def.components.is_empty(),
            "metric `{}` needs at least one component",
            self.def.code
        );
        self.def
    }
}

impl ComponentDefinition {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        key: &str,
        label: &str,
        unit: &str,
        body_region: BodyRegion,
        plausible: Bounds,
        normal: Bounds,
        warning: Bounds,
        decimals: u8,
        demo: DemoSignal,
    ) -> Self {
        Self {
            key: key.to_owned(),
            label: label.to_owned(),
            unit: unit.to_owned(),
            body_region,
            plausible,
            reference: ReferenceRange { normal, warning },
            decimals,
            demo,
        }
    }
}
