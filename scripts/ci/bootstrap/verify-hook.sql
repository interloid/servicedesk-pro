-- The custom access token hook must exist, with the grants Auth needs, before
-- it is enabled: an enabled hook that Auth can't call fails every sign-in.
-- Read only. The function and its grants come from the migrations
-- (supabase/schemas/functions/03_custom_access_token_hook.sql); nothing here
-- creates or replaces them.
do $$
declare
    v_fn regprocedure;
    v_count integer;
begin
    select count(*)
    into v_count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'custom_access_token_hook';

    if v_count = 0 then
        raise exception 'public.custom_access_token_hook does not exist. Apply the migrations first.';
    elsif v_count > 1 then
        raise exception 'public.custom_access_token_hook has % overloads; expected exactly one (jsonb).', v_count;
    end if;

    v_fn := to_regprocedure('public.custom_access_token_hook(jsonb)');
    if v_fn is null then
        raise exception 'public.custom_access_token_hook must take a single jsonb argument.';
    end if;

    if (select prorettype from pg_proc where oid = v_fn) <> 'jsonb'::regtype then
        raise exception 'public.custom_access_token_hook must return jsonb.';
    end if;

    if not (select prosecdef from pg_proc where oid = v_fn) then
        raise exception 'public.custom_access_token_hook must be SECURITY DEFINER.';
    end if;

    if not has_function_privilege('supabase_auth_admin', v_fn, 'execute') then
        raise exception 'supabase_auth_admin cannot execute public.custom_access_token_hook.';
    end if;

    if not has_schema_privilege('supabase_auth_admin', 'public', 'usage') then
        raise exception 'supabase_auth_admin has no USAGE on schema public.';
    end if;

    if not (has_table_privilege('supabase_auth_admin', 'public.memberships', 'select')
            and has_table_privilege('supabase_auth_admin', 'public.memberships', 'update')
            and has_table_privilege('supabase_auth_admin', 'public.tenants', 'select')) then
        raise exception 'supabase_auth_admin needs SELECT, UPDATE on public.memberships and SELECT on public.tenants.';
    end if;

    if has_function_privilege('anon', v_fn, 'execute')
       or has_function_privilege('authenticated', v_fn, 'execute') then
        raise exception 'anon or authenticated can execute public.custom_access_token_hook; it must be revoked.';
    end if;

    raise notice 'custom_access_token_hook: function and grants OK';
end;
$$;
