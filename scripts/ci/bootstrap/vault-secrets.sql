-- The Vault secrets the pg_cron jobs read to call the Edge Functions.
--
--   SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_PROJECT_REF=... \
--     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f vault-secrets.sql
--
-- The key is read from the environment (\getenv), not passed with -v, so it
-- never appears in a process list. A secret that already exists is left alone,
-- whatever its value: it may have been rotated on purpose. Values never reach
-- the output.
\getenv service_role_key SUPABASE_SERVICE_ROLE_KEY
\getenv project_ref SUPABASE_PROJECT_REF
select set_config('bootstrap.service_role_key', coalesce(:'service_role_key', ''), true) is not null as ok \gset
select set_config('bootstrap.project_ref', coalesce(:'project_ref', ''), true) is not null as ok \gset

do $$
declare
    v_ref text := current_setting('bootstrap.project_ref');
    v_base text;
    v_secret record;
    v_created integer := 0;
begin
    if v_ref !~ '^[a-z0-9]{20}$' then
        raise exception 'Invalid project ref';
    end if;
    if length(current_setting('bootstrap.service_role_key')) < 20 then
        raise exception 'SUPABASE_SERVICE_ROLE_KEY is missing';
    end if;
    v_base := 'https://' || v_ref || '.supabase.co/functions/v1/';

    -- Serialise concurrent runs on the names below.
    perform pg_advisory_xact_lock(hashtext('bootstrap.vault-secrets'));

    for v_secret in
        select *
        from (values
            ('service_role_key', current_setting('bootstrap.service_role_key')),
            ('email_jobs_url', v_base || 'email-jobs'),
            ('reconcile_subscriptions_url', v_base || 'reconcile-subscriptions'),
            ('portal_storage_sweep_url', v_base || 'portal-storage-sweep')
        ) as s(name, value)
    loop
        if exists (select 1 from vault.secrets where name = v_secret.name) then
            raise notice 'vault secret %: exists, unchanged', v_secret.name;
        else
            perform vault.create_secret(v_secret.value, v_secret.name);
            v_created := v_created + 1;
            raise notice 'vault secret %: created', v_secret.name;
        end if;
    end loop;
end;
$$;
