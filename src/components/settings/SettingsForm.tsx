import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { CURRENCIES, type Currency, type SettingsResponse, type UserSettings } from "@/types";

const fieldClassName =
  "border-white/20 bg-white/10 text-white placeholder:text-white/40 focus-visible:border-purple-400 focus-visible:ring-purple-400";

const CURRENCY_LABELS: Record<Currency, string> = {
  USD: t("settings.currencyOptions.USD"),
  EUR: t("settings.currencyOptions.EUR"),
  GBP: t("settings.currencyOptions.GBP"),
  PLN: t("settings.currencyOptions.PLN"),
  JPY: t("settings.currencyOptions.JPY"),
  CAD: t("settings.currencyOptions.CAD"),
  AUD: t("settings.currencyOptions.AUD"),
};

interface SettingsFormProps {
  initialSettings: UserSettings;
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const [currency, setCurrency] = useState<Currency>(initialSettings.currency);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    setSubmitting(true);
    setSaved(false);
    setServerError(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }),
      });

      if (!response.ok) {
        setServerError("Failed to save currency. Please try again.");
        return;
      }

      const { settings } = (await response.json()) as SettingsResponse;
      setCurrency(settings.currency);
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="settings-currency" className="mb-1 block text-sm text-blue-100/80">
          {t("settings.currencyHeading")}
        </label>
        <select
          id="settings-currency"
          value={currency}
          onChange={(e) => {
            setCurrency(e.target.value as Currency);
            setSaved(false);
          }}
          className={cn("h-9 w-full rounded-md border px-3 py-1 text-base shadow-xs outline-none", fieldClassName)}
        >
          {CURRENCIES.map((code) => (
            <option key={code} value={code} className="text-black">
              {CURRENCY_LABELS[code]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-blue-100/60">{t("settings.currencyNote")}</p>
      </div>

      {saved && (
        <p role="status" className="text-sm text-green-300">
          {t("settings.currencyUpdated")}
        </p>
      )}

      {serverError && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300"
        >
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
      >
        {submitting ? t("common.saving") : t("settings.saveButton")}
      </Button>
    </form>
  );
}
