use std::collections::BTreeMap;

use application::ports::outbound::{Bucket, InfraResult, MeasurementRepository, TimeRange};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use domain::crew::{AstronautId, StationId};
use domain::metrics::{MetricCode, Reading, RecordedReading};
use sqlx::types::Json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::infra;

/// Generic, metric-agnostic storage of history aggregates.
#[derive(Clone)]
pub struct PgMeasurementRepository {
    pool: PgPool,
}

impl PgMeasurementRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

type Components = Json<BTreeMap<String, f64>>;

fn metric_code(raw: String) -> Option<MetricCode> {
    // Rows of metrics no longer in the code are skipped, not fatal.
    MetricCode::new(raw).ok()
}

fn bucket_interval(b: Bucket) -> &'static str {
    match b {
        Bucket::Hour => "1 hour",
        Bucket::Day => "1 day",
        Bucket::Week => "7 days",
    }
}

#[async_trait]
impl MeasurementRepository for PgMeasurementRepository {
    async fn ensure_storage(&self, metrics: &[MetricCode]) -> InfraResult<()> {
        for code in metrics {
            // `MetricCode` is guaranteed to match [a-z][a-z0-9_]*, so it is safe
            // to use as an identifier and literal here.
            let sql = format!(
                "CREATE TABLE IF NOT EXISTS measurements_{code} \
                 PARTITION OF measurements FOR VALUES IN ('{code}')"
            );
            sqlx::query(&sql).execute(&self.pool).await.map_err(infra)?;
        }
        Ok(())
    }

    async fn append(&self, readings: &[RecordedReading]) -> InfraResult<u64> {
        if readings.is_empty() {
            return Ok(0);
        }
        let mut codes = Vec::with_capacity(readings.len());
        let mut astronauts = Vec::with_capacity(readings.len());
        let mut times = Vec::with_capacity(readings.len());
        let mut components = Vec::with_capacity(readings.len());
        let mut sources = Vec::with_capacity(readings.len());
        for r in readings {
            codes.push(r.metric().as_str().to_owned());
            astronauts.push(r.astronaut_id().0);
            times.push(r.reading().recorded_at);
            components.push(serde_json::to_string(&r.reading().values).expect("map serializes"));
            sources.push(r.source().to_owned());
        }

        let mut tx = self.pool.begin().await.map_err(infra)?;
        let inserted = sqlx::query(
            "INSERT INTO measurements (metric_code, astronaut_id, recorded_at, components, source)
             SELECT c, a, t, j::jsonb, s
             FROM UNNEST($1::text[], $2::uuid[], $3::timestamptz[], $4::text[], $5::text[])
                  AS x(c, a, t, j, s)
             ON CONFLICT DO NOTHING",
        )
        .bind(&codes)
        .bind(&astronauts)
        .bind(&times)
        .bind(&components)
        .bind(&sources)
        .execute(&mut *tx)
        .await
        .map_err(infra)?
        .rows_affected();

        sqlx::query(
            "INSERT INTO latest_measurements (astronaut_id, metric_code, recorded_at, components)
             SELECT DISTINCT ON (a, c) a, c, t, j::jsonb
             FROM UNNEST($1::text[], $2::uuid[], $3::timestamptz[], $4::text[]) AS x(c, a, t, j)
             ORDER BY a, c, t DESC
             ON CONFLICT (astronaut_id, metric_code) DO UPDATE
                SET recorded_at = EXCLUDED.recorded_at, components = EXCLUDED.components
                WHERE latest_measurements.recorded_at <= EXCLUDED.recorded_at",
        )
        .bind(&codes)
        .bind(&astronauts)
        .bind(&times)
        .bind(&components)
        .execute(&mut *tx)
        .await
        .map_err(infra)?;

        tx.commit().await.map_err(infra)?;
        Ok(inserted)
    }

    async fn latest(&self, astronaut: AstronautId) -> InfraResult<Vec<(MetricCode, Reading)>> {
        let rows: Vec<(String, DateTime<Utc>, Components)> = sqlx::query_as(
            "SELECT metric_code, recorded_at, components
             FROM latest_measurements WHERE astronaut_id = $1",
        )
        .bind(astronaut.0)
        .fetch_all(&self.pool)
        .await
        .map_err(infra)?;
        Ok(rows
            .into_iter()
            .filter_map(|(code, recorded_at, Json(values))| {
                Some((
                    metric_code(code)?,
                    Reading {
                        recorded_at,
                        values,
                    },
                ))
            })
            .collect())
    }

    async fn latest_for_station(
        &self,
        station: StationId,
    ) -> InfraResult<Vec<(AstronautId, MetricCode, Reading)>> {
        let rows: Vec<(Uuid, String, DateTime<Utc>, Components)> = sqlx::query_as(
            "SELECT l.astronaut_id, l.metric_code, l.recorded_at, l.components
             FROM latest_measurements l
             JOIN astronauts a ON a.id = l.astronaut_id
             WHERE a.station_id = $1",
        )
        .bind(station.0)
        .fetch_all(&self.pool)
        .await
        .map_err(infra)?;
        Ok(rows
            .into_iter()
            .filter_map(|(id, code, recorded_at, Json(values))| {
                Some((
                    AstronautId(id),
                    metric_code(code)?,
                    Reading {
                        recorded_at,
                        values,
                    },
                ))
            })
            .collect())
    }

    async fn series(
        &self,
        astronaut: AstronautId,
        metric: &MetricCode,
        range: TimeRange,
        bucket: Option<Bucket>,
    ) -> InfraResult<Vec<Reading>> {
        const FILTER: &str = "m.metric_code = $1 AND m.astronaut_id = $2
              AND ($3::timestamptz IS NULL OR m.recorded_at >= $3)
              AND ($4::timestamptz IS NULL OR m.recorded_at <= $4)";

        let query = match bucket {
            None => format!(
                "SELECT m.recorded_at, m.components FROM measurements m
                 WHERE {FILTER} ORDER BY m.recorded_at"
            ),
            // Average every component inside each time bucket. Generic over the
            // metric's components thanks to jsonb_each_text.
            Some(_) => format!(
                "SELECT b, jsonb_object_agg(k, v)
                 FROM (
                     SELECT date_bin(CAST($5 AS text)::interval, m.recorded_at,
                                     TIMESTAMPTZ '2000-01-03 00:00:00+00') AS b,
                            kv.key AS k, avg(kv.value::float8) AS v
                     FROM measurements m CROSS JOIN LATERAL jsonb_each_text(m.components) kv
                     WHERE {FILTER}
                     GROUP BY 1, 2
                 ) per_component
                 GROUP BY b ORDER BY b"
            ),
        };

        let mut q = sqlx::query_as::<_, (DateTime<Utc>, Components)>(&query)
            .bind(metric.as_str())
            .bind(astronaut.0)
            .bind(range.from)
            .bind(range.to);
        if let Some(b) = bucket {
            q = q.bind(bucket_interval(b));
        }
        let rows = q.fetch_all(&self.pool).await.map_err(infra)?;
        Ok(rows
            .into_iter()
            .map(|(recorded_at, Json(values))| Reading {
                recorded_at,
                values,
            })
            .collect())
    }
}
