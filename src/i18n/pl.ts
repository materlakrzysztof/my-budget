/**
 * Polish UI copy. The single source of user-facing strings — every `.astro`
 * page and `.tsx` island imports `t()` / `plural()` from `./index` rather than
 * reading this object directly.
 */
export const messages = {
  nav: {
    dashboard: "Pulpit",
    expenses: "Wydatki",
    settings: "Ustawienia",
    signOut: "Wyloguj się",
    notSignedIn: "Niezalogowany",
    signIn: "Zaloguj się",
    signUp: "Zarejestruj się",
  },
  common: {
    requiredField: "{field} jest wymagane",
  },
  dashboard: {},
  expense: {},
  category: {},
  settings: {
    currencyHeading: "Waluta",
  },
  auth: {
    noAccountPrompt: "Nie masz konta?",
    haveAccountPrompt: "Masz już konto?",
    confirmEmail: {
      autoConfirmed: {
        heading: "Rejestracja zakończona sukcesem",
        description: "Twoje konto zostało utworzone. Możesz się teraz zalogować.",
        linkText: "Przejdź do logowania",
      },
      pending: {
        heading: "Sprawdź swoją skrzynkę e-mail",
        description: "Wysłaliśmy link potwierdzający na Twój adres e-mail. Kliknij go, aby aktywować konto.",
        linkText: "Wróć do logowania",
      },
    },
  },
  errors: {},
  banner: {
    warningPrefix: "Uwaga:",
    docsLabel: "Dokumentacja",
  },
  meta: {
    defaultTitle: "MyBudget",
    dashboardTitle: "Pulpit",
    expensesTitle: "Wydatki",
    settingsTitle: "Ustawienia",
    landingTitle: "MyBudget | Śledź swoje wydatki w przejrzysty sposób",
    signInTitle: "Logowanie",
    signUpTitle: "Rejestracja",
  },
  landing: {
    heroTagline:
      "Miej pod kontrolą każdy wydatek, zrozum, na co wydajesz pieniądze, i łatwiej zarządzaj swoim miesięcznym budżetem.",
    featureTrackTitle: "Śledź każdy wydatek",
    featureTrackDescription: "Zapisuj zakupy na bieżąco i porządkuj je w kategoriach dopasowanych do Twojego życia.",
    featureClarityTitle: "Zobacz swój miesiąc wyraźnie",
    featureClarityDescription:
      "Zobacz sumę miesięcznych wydatków i podział na kategorie na jednym przejrzystym pulpicie.",
    featureCurrencyTitle: "Używaj swojej waluty",
    featureCurrencyDescription: "Ustaw walutę, której używasz, aby każda kwota wyświetlała się w znajomy sposób.",
  },
} as const;

export type Messages = typeof messages;
