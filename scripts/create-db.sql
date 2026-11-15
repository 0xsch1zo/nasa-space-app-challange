-- Creates the role and database the application expects on a local
-- PostgreSQL 16 (replaces the former `db` container: POSTGRES_USER=astro,
-- POSTGRES_PASSWORD=astro, POSTGRES_DB=astro_health). Idempotent.
--
-- Run as a PostgreSQL superuser:   npm run db:create
-- (set PGUSER / PGHOST / PGPORT / PGPASSWORD if your superuser differs).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'astro') THEN
    CREATE ROLE astro LOGIN PASSWORD 'astro';
  END IF;
END
$$;

SELECT 'CREATE DATABASE astro_health OWNER astro'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'astro_health')\gexec
