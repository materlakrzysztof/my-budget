import { t } from "@/i18n";

const KNOWN_MESSAGES: Record<string, string> = {
  "Invalid login credentials": t("errors.authInvalidCredentials"),
  "User already registered": t("errors.authUserAlreadyRegistered"),
  "Email not confirmed": t("errors.authEmailNotConfirmed"),
};

export function translateAuthError(message: string): string {
  return KNOWN_MESSAGES[message] ?? t("errors.authGeneric");
}
