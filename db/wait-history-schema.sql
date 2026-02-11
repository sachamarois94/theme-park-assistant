-- Wait history storage and baseline rollups for production.
-- Compatible with PostgreSQL 14+.

CREATE TABLE IF NOT EXISTS wait_observations (
  id BIGSERIAL PRIMARY KEY,
  observed_at TIMESTAMPTZ NOT NULL,
  source_updated_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  park_id TEXT NOT NULL,
  park_name TEXT NOT NULL,
  attraction_id TEXT NOT NULL,
  attraction_name TEXT NOT NULL,
  land TEXT,
  status TEXT NOT NULL,
  queue_type TEXT NOT NULL,
  wait_minutes SMALLINT,
  provider TEXT NOT NULL,
  CONSTRAINT wait_minutes_nonnegative CHECK (wait_minutes IS NULL OR wait_minutes BETWEEN 0 AND 480),
  CONSTRAINT wait_observations_dedupe_key UNIQUE (
    park_id,
    attraction_id,
    source_updated_at,
    status,
    queue_type
  )
);

CREATE INDEX IF NOT EXISTS idx_wait_observations_park_observed
  ON wait_observations (park_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_wait_observations_park_attr_observed
  ON wait_observations (park_id, attraction_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_wait_observations_ops_wait
  ON wait_observations (park_id, attraction_id, observed_at)
  WHERE status = 'OPERATING' AND wait_minutes IS NOT NULL;

CREATE MATERIALIZED VIEW IF NOT EXISTS wait_baseline_15m AS
SELECT
  park_id,
  attraction_id,
  attraction_name,
  land,
  EXTRACT(DOW FROM observed_at)::INT AS day_of_week,
  FLOOR((EXTRACT(HOUR FROM observed_at) * 60 + EXTRACT(MINUTE FROM observed_at)) / 15)::INT AS bucket_15m,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY wait_minutes)::NUMERIC(10, 2) AS median_wait_minutes,
  COUNT(*)::INT AS sample_count,
  MIN(observed_at) AS sample_from,
  MAX(observed_at) AS sample_to,
  NOW() AS refreshed_at
FROM wait_observations
WHERE status = 'OPERATING'
  AND wait_minutes IS NOT NULL
  AND observed_at >= NOW() - INTERVAL '8 weeks'
GROUP BY
  park_id,
  attraction_id,
  attraction_name,
  land,
  EXTRACT(DOW FROM observed_at)::INT,
  FLOOR((EXTRACT(HOUR FROM observed_at) * 60 + EXTRACT(MINUTE FROM observed_at)) / 15)::INT
HAVING COUNT(*) >= 6
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wait_baseline_15m_pk
  ON wait_baseline_15m (park_id, attraction_id, day_of_week, bucket_15m);

CREATE MATERIALIZED VIEW IF NOT EXISTS wait_baseline_hour AS
SELECT
  park_id,
  attraction_id,
  attraction_name,
  land,
  EXTRACT(DOW FROM observed_at)::INT AS day_of_week,
  EXTRACT(HOUR FROM observed_at)::INT AS hour_of_day,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY wait_minutes)::NUMERIC(10, 2) AS median_wait_minutes,
  COUNT(*)::INT AS sample_count,
  MIN(observed_at) AS sample_from,
  MAX(observed_at) AS sample_to,
  NOW() AS refreshed_at
FROM wait_observations
WHERE status = 'OPERATING'
  AND wait_minutes IS NOT NULL
  AND observed_at >= NOW() - INTERVAL '8 weeks'
GROUP BY
  park_id,
  attraction_id,
  attraction_name,
  land,
  EXTRACT(DOW FROM observed_at)::INT,
  EXTRACT(HOUR FROM observed_at)::INT
HAVING COUNT(*) >= 8
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wait_baseline_hour_pk
  ON wait_baseline_hour (park_id, attraction_id, day_of_week, hour_of_day);

CREATE MATERIALIZED VIEW IF NOT EXISTS wait_baseline_global AS
SELECT
  park_id,
  attraction_id,
  attraction_name,
  land,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY wait_minutes)::NUMERIC(10, 2) AS median_wait_minutes,
  COUNT(*)::INT AS sample_count,
  MIN(observed_at) AS sample_from,
  MAX(observed_at) AS sample_to,
  NOW() AS refreshed_at
FROM wait_observations
WHERE status = 'OPERATING'
  AND wait_minutes IS NOT NULL
  AND observed_at >= NOW() - INTERVAL '8 weeks'
GROUP BY
  park_id,
  attraction_id,
  attraction_name,
  land
HAVING COUNT(*) >= 8
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wait_baseline_global_pk
  ON wait_baseline_global (park_id, attraction_id);

CREATE OR REPLACE FUNCTION refresh_wait_baselines() RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW wait_baseline_15m;
  REFRESH MATERIALIZED VIEW wait_baseline_hour;
  REFRESH MATERIALIZED VIEW wait_baseline_global;
END;
$$;

CREATE OR REPLACE FUNCTION prune_wait_observations(retention INTERVAL DEFAULT INTERVAL '120 days')
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  removed BIGINT;
BEGIN
  DELETE FROM wait_observations
  WHERE observed_at < NOW() - retention;

  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;
