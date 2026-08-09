import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";
import { t } from "@/i18n";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  message: string;
  docsUrl?: string;
  docsLabel?: string;
}

export const configStatuses: ConfigStatus[] = [
  {
    name: "Supabase",
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    message: t("banner.supabaseNotConfigured"),
    docsUrl: "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration",
    docsLabel: t("banner.supabaseDocsLabel"),
  },
];

export const missingConfigs = configStatuses.filter((s) => !s.configured);
