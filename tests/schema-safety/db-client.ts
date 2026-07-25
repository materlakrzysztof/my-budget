import { Client } from "pg";

/**
 * Fixed local-only connection details for the ephemeral Postgres `supabase
 * start` boots (supabase/config.toml:29, CLI's well-known local superuser).
 * Never points at a hosted project — this suite only ever runs against the
 * throwaway container the same CI job creates.
 */
const LOCAL_SUPABASE_DB = {
  host: "127.0.0.1",
  port: 54322,
  user: "postgres",
  password: "postgres",
  database: "postgres",
};

export function createDbClient(): Client {
  return new Client(LOCAL_SUPABASE_DB);
}
