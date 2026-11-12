-- The Business plan advertised "AI automation", which the product doesn't
-- have. The billing pages list every enabled feature flag and show the plan's
-- description, so both reached customers. Remove the flag and replace the
-- seeded description; a description someone has since edited is left alone.
update public.plans
set features_json = features_json - 'ai_automation',
    description = case
        when description = 'Advanced governance, AI automation, and scale for larger teams.'
            then 'For larger teams that need an audit log, more seats and more storage.'
        else description
    end,
    updated_at = now()
where features_json ? 'ai_automation'
   or description = 'Advanced governance, AI automation, and scale for larger teams.';
