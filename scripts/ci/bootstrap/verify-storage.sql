-- Buckets and their policies, read only. Buckets come from
-- supabase/schemas/storage/buckets.sql; policies come from the migrations.
do $$
declare
    v_missing text;
begin
    select string_agg(b.id || ' (' || b.problem || ')', ', ')
    into v_missing
    from (
        select e.id,
               case
                   when sb.id is null then 'missing'
                   when sb.public <> e.public then 'public should be ' || e.public
                   when sb.file_size_limit is distinct from e.size then 'size limit should be ' || e.size
                   when e.mime is not null and sb.allowed_mime_types is distinct from e.mime then 'MIME types differ'
               end as problem
        from (values
            ('invoices', false, 10485760::bigint, null::text[]),
            ('branding', true, 2097152, '{image/png,image/jpeg,image/webp}'),
            ('avatars', true, 5242880, '{image/png,image/jpeg,image/gif,image/webp}'),
            ('ticket-attachments', false, 20971520, null)
        ) as e(id, public, size, mime)
        left join storage.buckets sb on sb.id = e.id
    ) b
    where b.problem is not null;

    if v_missing is not null then
        raise exception 'Storage buckets: %', v_missing;
    end if;

    if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then
        raise exception 'RLS is off on storage.objects.';
    end if;

    select string_agg(e.name, ', ')
    into v_missing
    from (values
        ('avatars_select'),
        ('invoices_select'),
        ('ticket_attachments_select'),
        ('ticket_attachments_insert'),
        ('ticket_attachments_update'),
        ('ticket_attachments_delete'),
        ('workspace_not_blocked')
    ) as e(name)
    where not exists (
        select 1 from pg_policies p
        where p.schemaname = 'storage'
          and p.tablename = 'objects'
          and p.policyname = e.name
    );

    if v_missing is not null then
        raise exception 'storage.objects is missing policies: %. Apply the migrations first.', v_missing;
    end if;

    raise notice 'storage: 4 buckets and 7 policies OK';
end;
$$;
