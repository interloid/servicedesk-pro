-- Every table with a tenant_id column: a member of Alpha, by role, cannot read,
-- change or delete Bravo's rows by naming them. Generated from the catalog, so a
-- new tenant table is covered without editing this file. Refusal is either no
-- matching rows (RLS) or 42501 (no table privilege for the API role). A table
-- where Bravo has no rows would pass trivially, so it is listed as not
-- exercised instead.

DO $$
DECLARE
    t regclass;
    who record;
    bravo_rows bigint;
BEGIN
    FOR t IN
        SELECT c.oid::regclass
        FROM pg_class AS c
        JOIN pg_attribute AS a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
        WHERE c.relnamespace = 'public'::regnamespace
          AND c.relkind = 'r'
        ORDER BY c.relname
    LOOP
        EXECUTE format('SELECT count(*) FROM %s WHERE tenant_id = %L', t, authz.id('b_tenant'))
            INTO bravo_rows;

        IF bravo_rows = 0 THEN
            INSERT INTO authz.not_exercised VALUES (format('cross-tenant sweep: %s (no Bravo rows)', t));
            CONTINUE;
        END IF;

        FOR who IN
            SELECT * FROM (VALUES
                ('a_admin', 'tenant_admin'),
                ('a_customer_user', 'customer')
            ) AS v(usr, role)
        LOOP
            PERFORM authz.expect_refused(
                format('%s cannot read another workspace''s %s', who.role, t),
                authz.claims(who.usr, 'a_tenant', who.role),
                'authenticated',
                format('SELECT 1 FROM %s WHERE tenant_id = %L', t, authz.id('b_tenant')),
                ARRAY['0rows', '42501']
            );

            PERFORM authz.expect_refused(
                format('%s cannot update another workspace''s %s', who.role, t),
                authz.claims(who.usr, 'a_tenant', who.role),
                'authenticated',
                format('UPDATE %s SET tenant_id = tenant_id WHERE tenant_id = %L', t, authz.id('b_tenant')),
                ARRAY['0rows', '42501']
            );

            PERFORM authz.expect_refused(
                format('%s cannot delete another workspace''s %s', who.role, t),
                authz.claims(who.usr, 'a_tenant', who.role),
                'authenticated',
                format('DELETE FROM %s WHERE tenant_id = %L', t, authz.id('b_tenant')),
                ARRAY['0rows', '42501']
            );
        END LOOP;
    END LOOP;
END
$$;
