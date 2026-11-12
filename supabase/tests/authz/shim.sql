-- Minimal stand-ins for the parts of a Supabase database that the migrations
-- expect but plain PostgreSQL does not have: the API roles, the auth and storage
-- schemas, and no-op cron, net and vault APIs.
--
-- This lets the authorization suite run against a throwaway local PostgreSQL
-- cluster with no Docker or Supabase CLI. Policies, grants and triggers come from
-- the real migrations; only the platform underneath is simulated. Never run this
-- file against a real Supabase project.

-- Roles ---------------------------------------------------------------------

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY[
        'anon', 'authenticated', 'service_role', 'authenticator',
        'supabase_auth_admin', 'supabase_storage_admin', 'supabase_admin',
        'supabase_realtime_admin', 'dashboard_user', 'pgbouncer'
    ]
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('CREATE ROLE %I NOLOGIN', r);
        END IF;
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        CREATE ROLE postgres SUPERUSER LOGIN;
    END IF;
END
$$;

ALTER ROLE service_role BYPASSRLS;
GRANT anon, authenticated, service_role TO postgres;

-- The hosted platform grants the API roles everything on public objects that
-- postgres creates; RLS and explicit REVOKEs in the migrations narrow it. The
-- migrations do not record this (tracker SEC-033), so it is set up here.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- auth ----------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, supabase_auth_admin;

CREATE TABLE IF NOT EXISTS auth.users (
    instance_id uuid,
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aud text DEFAULT 'authenticated',
    role text DEFAULT 'authenticated',
    email text,
    encrypted_password text,
    email_confirmed_at timestamptz,
    confirmed_at timestamptz,
    last_sign_in_at timestamptz,
    raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    is_anonymous boolean DEFAULT false,
    banned_until timestamptz,
    phone text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz
);

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
    SELECT coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb;
$$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
    SELECT nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
    SELECT auth.jwt() ->> 'role';
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
LANGUAGE sql STABLE AS $$
    SELECT auth.jwt() ->> 'email';
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;

-- storage -------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS storage.buckets (
    id text PRIMARY KEY,
    name text NOT NULL,
    owner uuid,
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text REFERENCES storage.buckets(id),
    name text,
    owner uuid,
    owner_id text,
    metadata jsonb,
    user_metadata jsonb,
    version text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    last_accessed_at timestamptz DEFAULT now(),
    UNIQUE (bucket_id, name)
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
GRANT ALL ON storage.objects, storage.buckets TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
    SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;

CREATE OR REPLACE FUNCTION storage.filename(name text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)];
$$;

CREATE OR REPLACE FUNCTION storage.extension(name text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT reverse(split_part(reverse(name), '.', 1));
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA storage TO anon, authenticated, service_role;

-- cron, net, vault: no-op stand-ins -----------------------------------------

CREATE SCHEMA IF NOT EXISTS cron;
CREATE TABLE IF NOT EXISTS cron.job (
    jobid bigserial PRIMARY KEY,
    schedule text,
    command text,
    nodename text DEFAULT 'localhost',
    nodeport int DEFAULT 5432,
    database text DEFAULT current_database(),
    username text DEFAULT current_user,
    active boolean DEFAULT true,
    jobname text UNIQUE
);
CREATE TABLE IF NOT EXISTS cron.job_run_details (
    jobid bigint,
    runid bigserial PRIMARY KEY,
    job_pid int,
    database text,
    username text,
    command text,
    status text,
    return_message text,
    start_time timestamptz,
    end_time timestamptz
);

CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text)
RETURNS bigint LANGUAGE sql AS $$
    INSERT INTO cron.job (jobname, schedule, command)
    VALUES (job_name, schedule, command)
    ON CONFLICT (jobname) DO UPDATE SET schedule = excluded.schedule, command = excluded.command
    RETURNING jobid;
$$;

CREATE OR REPLACE FUNCTION cron.schedule(schedule text, command text)
RETURNS bigint LANGUAGE sql AS $$
    INSERT INTO cron.job (schedule, command) VALUES (schedule, command) RETURNING jobid;
$$;

CREATE OR REPLACE FUNCTION cron.unschedule(job_name text)
RETURNS boolean LANGUAGE sql AS $$
    WITH d AS (DELETE FROM cron.job WHERE jobname = job_name RETURNING 1)
    SELECT EXISTS (SELECT 1 FROM d);
$$;

CREATE OR REPLACE FUNCTION cron.unschedule(job_id bigint)
RETURNS boolean LANGUAGE sql AS $$
    WITH d AS (DELETE FROM cron.job WHERE jobid = job_id RETURNING 1)
    SELECT EXISTS (SELECT 1 FROM d);
$$;

CREATE SCHEMA IF NOT EXISTS net;
CREATE TABLE IF NOT EXISTS net._http_response (
    id bigint,
    status_code int,
    content text,
    created timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION net.http_post(
    url text,
    body jsonb DEFAULT '{}'::jsonb,
    params jsonb DEFAULT '{}'::jsonb,
    headers jsonb DEFAULT '{}'::jsonb,
    timeout_milliseconds int DEFAULT 5000
) RETURNS bigint LANGUAGE sql AS $$ SELECT 0::bigint; $$;

CREATE SCHEMA IF NOT EXISTS vault;
CREATE TABLE IF NOT EXISTS vault.secrets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE,
    description text,
    secret text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE OR REPLACE VIEW vault.decrypted_secrets AS
    SELECT id, name, description, secret, secret AS decrypted_secret, created_at, updated_at
    FROM vault.secrets;
CREATE OR REPLACE FUNCTION vault.create_secret(
    new_secret text, new_name text DEFAULT NULL, new_description text DEFAULT ''
) RETURNS uuid LANGUAGE sql AS $$
    INSERT INTO vault.secrets (secret, name, description)
    VALUES (new_secret, new_name, new_description)
    RETURNING id;
$$;

-- Realtime publication, so the migrations' guarded ALTER PUBLICATION runs.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END
$$;
