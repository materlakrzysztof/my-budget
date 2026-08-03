/**
 * Polish UI copy. The single source of user-facing strings — every `.astro`
 * page and `.tsx` island imports `t()` / `plural()` from `./index` rather than
 * reading this object directly.
 */
export const messages = {
  nav: {},
  common: {
    requiredField: "{field} jest wymagane",
  },
  dashboard: {},
  expense: {},
  category: {},
  settings: {},
  auth: {},
  errors: {},
  banner: {},
  meta: {
    defaultTitle: "MyBudget",
  },
} as const;

export type Messages = typeof messages;
