-- Test helpers for the authorization suite. Lives in its own schema, which the
-- API roles cannot see.

CREATE SCHEMA IF NOT EXISTS authz;

CREATE TABLE IF NOT EXISTS authz.results (
    id serial PRIMARY KEY,
    kind text NOT NULL,          -- 'attack' must be refused; 'control' must work
    label text NOT NULL,
    passed boolean NOT NULL,
    detail text
);

-- Checks that could not run, e.g. a table the fixtures leave empty. Printed by
-- run.sh, never counted as passes.
CREATE TABLE IF NOT EXISTS authz.not_exercised (
    label text PRIMARY KEY
);

-- Named fixture ids, so cases read as "a_ticket" rather than a UUID.
CREATE TABLE IF NOT EXISTS authz.ids (
    name text PRIMARY KEY,
    id uuid NOT NULL
);

CREATE OR REPLACE FUNCTION authz.id(p_name text) RETURNS uuid
LANGUAGE sql STABLE AS $$
    SELECT id FROM authz.ids WHERE name = p_name;
$$;

-- The claims the access token hook issues, for a member of one workspace.
CREATE OR REPLACE FUNCTION authz.claims(p_user text, p_tenant text DEFAULT NULL, p_role text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE AS $$
    SELECT jsonb_strip_nulls(jsonb_build_object(
        'sub', authz.id(p_user),
        'role', 'authenticated',
        'aud', 'authenticated',
        'tenant_id', authz.id(p_tenant),
        'tenant_slug', (SELECT slug FROM public.tenants WHERE id = authz.id(p_tenant)),
        'tenant_role', p_role
    ));
$$;

CREATE OR REPLACE FUNCTION authz.record(p_kind text, p_label text, p_passed boolean, p_detail text)
RETURNS void
LANGUAGE sql AS $$
    INSERT INTO authz.results (kind, label, passed, detail)
    VALUES (p_kind, p_label, p_passed, p_detail);
$$;

-- Run one statement as an API role with the given claims, then roll it back.
-- Returns 'ok' and the affected (or returned) row count, or the SQLSTATE.
CREATE OR REPLACE FUNCTION authz.attempt(
    p_claims jsonb,
    p_role text,
    p_sql text,
    OUT state text,
    OUT row_count bigint,
    OUT message text
)
LANGUAGE plpgsql AS $$
DECLARE
    n bigint;
BEGIN
    BEGIN
        PERFORM set_config('request.jwt.claims', coalesce(p_claims::text, ''), true);
        EXECUTE format('SET LOCAL ROLE %I', p_role);
        EXECUTE p_sql;
        GET DIAGNOSTICS n = ROW_COUNT;
        -- Undo whatever the statement did, keeping only its row count.
        RAISE EXCEPTION USING ERRCODE = 'AZ000', MESSAGE = n::text;
    EXCEPTION
        WHEN SQLSTATE 'AZ000' THEN
            state := 'ok';
            row_count := SQLERRM::bigint;
        WHEN OTHERS THEN
            state := SQLSTATE;
            row_count := 0;
            message := SQLERRM;
    END;
    PERFORM set_config('request.jwt.claims', '', true);
END;
$$;

-- An attack passes only when it fails in the expected way: one of the named
-- SQLSTATEs, or '0rows' for an update, delete or read that matched nothing.
-- Any other error is a FAIL, so a typo or a missing fixture can't pass as a
-- refusal.
CREATE OR REPLACE FUNCTION authz.expect_refused(
    p_label text,
    p_claims jsonb,
    p_role text,
    p_sql text,
    p_expected text[]
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    r record;
    ok boolean;
BEGIN
    SELECT * INTO r FROM authz.attempt(p_claims, p_role, p_sql);
    ok := (r.state = ANY (p_expected))
          OR ('0rows' = ANY (p_expected) AND r.state = 'ok' AND r.row_count = 0);
    PERFORM authz.record(
        'attack',
        p_label,
        ok,
        CASE
            WHEN r.state = 'ok' THEN format('statement succeeded, %s row(s)', r.row_count)
            ELSE format('%s %s', r.state, r.message)
        END
    );
END;
$$;

-- A legitimate action must succeed and touch exactly (or at least) n rows.
CREATE OR REPLACE FUNCTION authz.expect_allowed(
    p_label text,
    p_claims jsonb,
    p_role text,
    p_sql text,
    p_rows bigint DEFAULT 1,
    p_at_least boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    r record;
BEGIN
    SELECT * INTO r FROM authz.attempt(p_claims, p_role, p_sql);
    PERFORM authz.record(
        'control',
        p_label,
        r.state = 'ok' AND (
            (p_at_least AND r.row_count >= p_rows)
            OR (NOT p_at_least AND r.row_count = p_rows)
        ),
        CASE
            WHEN r.state = 'ok' THEN format('%s row(s), expected %s%s', r.row_count,
                                            CASE WHEN p_at_least THEN 'at least ' ELSE '' END, p_rows)
            ELSE format('%s %s', r.state, r.message)
        END
    );
END;
$$;

-- What a read returns: exactly n rows. Used for both kinds, e.g. a customer
-- listing members must see only their own row (attack), and staff must still
-- see the whole team (control).
CREATE OR REPLACE FUNCTION authz.expect_rows(
    p_kind text,
    p_label text,
    p_claims jsonb,
    p_role text,
    p_sql text,
    p_rows bigint
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    r record;
BEGIN
    SELECT * INTO r FROM authz.attempt(p_claims, p_role, p_sql);
    PERFORM authz.record(
        p_kind,
        p_label,
        r.state = 'ok' AND r.row_count = p_rows,
        CASE
            WHEN r.state = 'ok' THEN format('%s row(s), expected %s', r.row_count, p_rows)
            ELSE format('%s %s', r.state, r.message)
        END
    );
END;
$$;
