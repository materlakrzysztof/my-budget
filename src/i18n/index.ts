import { messages, type Messages } from "./pl";

type Join<K extends string, Rest extends string> = Rest extends "" ? K : `${K}.${Rest}`;

type MessageKey<T> = T extends string ? "" : { [K in keyof T & string]: Join<K, MessageKey<T[K]>> }[keyof T & string];

type MessageValue<T, Path extends string> = Path extends `${infer Head}.${infer Tail}`
  ? Head extends keyof T
    ? MessageValue<T[Head], Tail>
    : never
  : Path extends keyof T
    ? T[Path]
    : never;

export type TranslationKey = MessageKey<Messages>;

function resolve(key: string): string {
  const value = key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, messages);

  if (typeof value !== "string") {
    throw new Error(`Missing translation for key "${key}"`);
  }
  return value;
}

export function t<Key extends TranslationKey>(
  key: MessageValue<Messages, Key> extends string ? Key : never,
  params?: Record<string, string | number>,
): string {
  const raw = resolve(key);
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

interface PluralVariants {
  one: string;
  few: string;
  many: string;
  other: string;
}

const pluralRules = new Intl.PluralRules("pl");

export function plural(count: number, variants: PluralVariants): string {
  const category = pluralRules.select(count) as keyof PluralVariants;
  return variants[category].replace(/\{count\}/g, String(count));
}
