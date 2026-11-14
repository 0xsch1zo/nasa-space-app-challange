//! Demo seeder: creates stations, crew, accounts and months of realistic
//! history for every metric in the catalog.
//!
//! Measurements are sent through the `MeasurementIngestion` input port, the
//! same entry point a real medical-device gateway would use, so they are
//! validated by the domain exactly like production data.
//!
//! Usage: `seed` (skips if data exists) or `seed --reset`.

use std::collections::HashMap;

use adapter_postgres::PgSeedWriter;
use application::ports::inbound::{DeviceMeasurement, MeasurementIngestion};
use application::ports::outbound::PasswordHasher;
use chrono::{Duration, NaiveDate, Utc};
use domain::crew::AstronautId;
use domain::metrics::MetricDefinition;
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};
use rand_distr::{Distribution, Normal};
use server::{build, init_tracing, prepare_database, Config};
use uuid::Uuid;

pub const DEMO_PASSWORD: &str = "orbita2026";

struct CrewSeed {
    username: &'static str,
    name: &'static str,
    agency: &'static str,
    specialty: &'static str,
    station: usize,
    days_in_orbit: i64,
    /// Per-metric multiplier of the physiological drift (1.0 = typical).
    /// Metrics not listed use 1.0, so new metrics get data automatically.
    risk: &'static [(&'static str, f64)],
}

const STATIONS: [&str; 2] = ["Stacja Orbitalna Aurora", "Lunar Gateway Selene"];

const CREW: &[CrewSeed] = &[
    CrewSeed {
        username: "anna.kowalska",
        name: "Anna Kowalska",
        agency: "POLSA",
        specialty: "Inżynier pokładowy",
        station: 0,
        days_in_orbit: 168,
        risk: &[
            ("blood_pressure", 0.8),
            ("bone_density", 1.35),
            ("muscle_atrophy", 1.6),
        ],
    },
    CrewSeed {
        username: "marcus.reyes",
        name: "Marcus Reyes",
        agency: "NASA",
        specialty: "Dowódca",
        station: 0,
        days_in_orbit: 168,
        risk: &[
            ("blood_pressure", 2.6),
            ("bone_density", 0.8),
            ("muscle_atrophy", 0.7),
        ],
    },
    CrewSeed {
        username: "yuki.tanaka",
        name: "Yuki Tanaka",
        agency: "JAXA",
        specialty: "Specjalista misji",
        station: 0,
        days_in_orbit: 95,
        risk: &[],
    },
    CrewSeed {
        username: "lena.hoffmann",
        name: "Lena Hoffmann",
        agency: "ESA",
        specialty: "Lekarz pokładowy",
        station: 0,
        days_in_orbit: 31,
        risk: &[("muscle_atrophy", 0.8)],
    },
    CrewSeed {
        username: "omar.haddad",
        name: "Omar Haddad",
        agency: "ESA",
        specialty: "Pilot",
        station: 1,
        days_in_orbit: 64,
        risk: &[("bone_density", 1.2)],
    },
];

struct SupervisorSeed {
    username: &'static str,
    name: &'static str,
    station: usize,
}

const SUPERVISORS: &[SupervisorSeed] = &[
    SupervisorSeed {
        username: "lekarz.aurora",
        name: "dr Ewa Nowak (lekarz lotu)",
        station: 0,
    },
    SupervisorSeed {
        username: "lekarz.selene",
        name: "dr Tomás Ruiz (lekarz lotu)",
        station: 1,
    },
];

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing();
    let reset = std::env::args().any(|a| a == "--reset");
    let config = Config::from_env()?;
    let pool = adapter_postgres::connect(&config.database_url).await?;
    let container = build(pool.clone(), &config);
    prepare_database(&pool, &container.catalog).await?;

    let writer = PgSeedWriter::new(pool.clone());
    if writer.has_users().await? {
        if !reset {
            tracing::info!("database already seeded, skipping (use --reset to re-create)");
            return Ok(());
        }
        writer.reset().await?;
    }

    let station_ids: Vec<Uuid> = STATIONS.iter().map(|_| Uuid::new_v4()).collect();
    for (id, name) in station_ids.iter().zip(STATIONS) {
        writer.station(*id, name).await?;
    }
    let hash = container
        .hasher
        .hash(DEMO_PASSWORD)
        .map_err(|e| anyhow::anyhow!(e))?;
    for s in SUPERVISORS {
        writer
            .user(
                s.username,
                s.name,
                &hash,
                "supervisor",
                station_ids[s.station],
                None,
            )
            .await?;
    }

    let today = Utc::now();
    for (idx, c) in CREW.iter().enumerate() {
        let id = Uuid::new_v4();
        let start: NaiveDate = (today - Duration::days(c.days_in_orbit - 1)).date_naive();
        writer
            .astronaut(
                id,
                station_ids[c.station],
                c.name,
                c.agency,
                c.specialty,
                start,
            )
            .await?;
        writer
            .user(
                c.username,
                c.name,
                &hash,
                "astronaut",
                station_ids[c.station],
                Some(id),
            )
            .await?;

        let risk: HashMap<&str, f64> = c.risk.iter().copied().collect();
        let mut rng = StdRng::seed_from_u64(1000 + idx as u64);
        let mut batch = Vec::new();
        for def in container.catalog.all() {
            let r = risk.get(def.code.as_str()).copied().unwrap_or(1.0);
            batch.extend(simulate(def, AstronautId(id), c.days_in_orbit, r, &mut rng));
        }
        let total = batch.len();
        let mut accepted = 0;
        for chunk in batch.chunks(2000) {
            let report = container.ingestion.ingest(chunk.to_vec()).await?;
            accepted += report.accepted;
            for (i, why) in report.rejected {
                tracing::warn!(index = i, reason = %why, "measurement rejected");
            }
        }
        tracing::info!(astronaut = c.name, accepted, total, "seeded history");
    }

    println!("\nSeed complete. Demo accounts (password: {DEMO_PASSWORD}):");
    for s in SUPERVISORS {
        println!("  supervisor  {:<16} {}", s.username, STATIONS[s.station]);
    }
    for c in CREW {
        println!("  astronaut   {:<16} {}", c.username, STATIONS[c.station]);
    }
    Ok(())
}

/// Generic signal generator driven by each component's `DemoSignal`.
fn simulate(
    def: &MetricDefinition,
    astronaut: AstronautId,
    days: i64,
    risk: f64,
    rng: &mut StdRng,
) -> Vec<DeviceMeasurement> {
    let now = Utc::now();
    let first_day = (now - Duration::days(days - 1)).date_naive();
    let start = first_day.and_hms_opt(0, 0, 0).expect("midnight").and_utc();
    let step = Duration::hours(i64::from(def.sampling_interval_hours.max(1)));
    // Stable per-astronaut deviation from the population baseline.
    let offsets: Vec<f64> = def
        .components
        .iter()
        .map(|c| normal(c.demo.spread).sample(rng))
        .collect();

    let mut out = Vec::new();
    let mut t = start + Duration::hours(7); // morning measurement, 07:00 UTC
    while t <= now {
        let jitter = Duration::minutes(rng.gen_range(-40..=40));
        let at = (t + jitter).min(now);
        let day = (at - start).num_seconds() as f64 / 86_400.0;
        let values = def
            .components
            .iter()
            .zip(&offsets)
            .map(|(c, off)| {
                let s = c.demo;
                let raw =
                    s.baseline + off + s.drift_per_day * day * risk + normal(s.noise).sample(rng);
                let lo = c.plausible.min.unwrap_or(f64::MIN);
                let hi = c.plausible.max.unwrap_or(f64::MAX);
                let factor = 10f64.powi(i32::from(c.decimals));
                (
                    c.key.clone(),
                    ((raw.clamp(lo, hi)) * factor).round() / factor,
                )
            })
            .collect();
        out.push(DeviceMeasurement {
            astronaut_id: astronaut,
            metric: def.code.to_string(),
            recorded_at: at,
            values,
            source: format!("sim-{}", def.code),
        });
        t += step;
    }
    out
}

fn normal(sd: f64) -> Normal<f64> {
    Normal::new(0.0, sd.max(f64::EPSILON)).expect("valid normal distribution")
}
