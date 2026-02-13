-- Migration helper: add hashed local-site token support
-- Goal: move away from plaintext auth_config.token

-- 1) Optional: inspect existing local_site integrations
-- select id, partner_id, auth_config
-- from public.partner_integrations
-- where kind = 'local_site';

-- 2) For each partner token, compute sha256(token) in your secure admin process
-- and write auth_config.token_hash.
--
-- Example (replace placeholders):
-- update public.partner_integrations
-- set auth_config = jsonb_set(
--   coalesce(auth_config, '{}'::jsonb),
--   '{token_hash}',
--   to_jsonb('<SHA256_HEX>'::text),
--   true
-- )
-- where id = '<integration_id>';

-- 3) Optional cleanup after rollout:
-- remove plaintext token from auth_config once all clients use Authorization header.
--
-- update public.partner_integrations
-- set auth_config = auth_config - 'token'
-- where kind = 'local_site' and auth_config ? 'token_hash';
