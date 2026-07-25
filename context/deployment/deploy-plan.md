# Plan: Pierwsze wdrożenie MyBudget na Cloudflare

## Kontekst

`context/foundation/infrastructure.md` wskazał Cloudflare Workers jako platformę wdrożeniową (zero kosztu przełączenia — stack już jest wpięty przez `@astrojs/cloudflare`, $0/miesiąc przy oczekiwanym ruchu). Projekt jest świeżo zeskafoldowany z `10x-astro-starter` — istnieją tylko strony auth (signup/signin/confirm-email) i przykładowa chroniona strona `/dashboard`; funkcje budżetowe (kategorie, wydatki, podsumowanie) jeszcze nie powstały. Celem TEGO wdrożenia jest udowodnienie, że pipeline deploymentu działa end-to-end — nie wysyłka funkcji budżetowych.

Eksploracja repo (odczyt bezpośredni + subagent) potwierdziła:

- `astro.config.mjs` — adapter Cloudflare skonfigurowany, `output: "server"`, `env.schema` deklaruje `SUPABASE_URL`/`SUPABASE_KEY` jako `optional: true`.
- `wrangler.jsonc` — nazwa workera to wciąż domyślna `"10x-astro-starter"`, brak `account_id`, brak bindings, pojedyncze środowisko.
- `supabase/config.toml` istnieje (z `supabase init`) z `project_id = "10x-astro-starter"`; **brak `supabase/migrations/`** — nie ma jeszcze żadnego schematu.
- Brak `.env`/`.dev.vars` lokalnie (poprawnie zignorowane w `.gitignore`).
- `.github/workflows/ci.yml` robi tylko lint+build, żadnego kroku deploy.
- `wrangler` i `supabase` CLI już są w `devDependencies` i zainstalowane.
- Brak lokalnej sesji auth Wranglera — środowisko nie jest zalogowane do Cloudflare.
- **Kluczowe odkrycie z `src/lib/supabase.ts`**: `createClient()` celowo degraduje się do `null`, gdy `SUPABASE_URL`/`SUPABASE_KEY` są puste — build i deploy **przejdą pomyślnie nawet bez prawdziwych danych Supabase**, tylko UI pokaże baner "nieskonfigurowane". To realne ryzyko cichej pomyłki, które trzeba jawnie zweryfikować po deployu.

Ustalenia z użytkownikiem:

- Supabase: użytkownik sam założy chmurowy projekt (przeglądarka) i poda `SUPABASE_URL` + anon key.
- Cloudflare: użytkownik sam wykona `wrangler login` (interaktywny OAuth) i da znać po zakończeniu.
- Zakres: tylko jednorazowy ręczny deploy — bez spinania CI/CD w tym przejściu.

## Kroki

### Faza -1 — Zapis planu w repo (AGENT, samodzielnie, pierwszy krok wykonania)

0. Zapisz treść tego planu do `context/deployment/deploy-plan.md` (tworząc katalog `context/deployment/` jeśli nie istnieje) — tak żeby plan wdrożenia był częścią repo, nie tylko lokalnego pliku planu poza projektem.

### Faza 0 — Sprzątanie konfiguracji (AGENT, samodzielnie)

1. **`wrangler.jsonc`** — zmień `"name": "10x-astro-starter"` → `"name": "my-budget"`. Nic więcej w tym pliku nie wymaga zmian na pierwszy deploy (brak `account_id` zostaje puste — patrz punkt 2).
2. **`account_id`** — NIE dodawaj go na sztywno do `wrangler.jsonc`. Po `wrangler login` (Faza 1) Wrangler sam wykryje konto, jeśli użytkownik ma dokładnie jedno konto Cloudflare. Dopiero jeśli `wrangler deploy --dry-run` (krok 9) poprosi o rozstrzygnięcie wieloznaczności kont, ustaw `CLOUDFLARE_ACCOUNT_ID` jako zmienną środowiskową tylko na czas tej jednej komendy — nie zapisuj go nigdzie na stałe.
3. **`supabase/config.toml`** — zmień `project_id = "10x-astro-starter"` → `project_id = "my-budget"`. To tylko lokalny identyfikator CLI (namespacing kontenerów Docker), nie musi pasować do niczego w chmurowym projekcie użytkownika.
4. **Migracje: świadomie ZERO.** Auth Supabase (wbudowana tabela `auth.users`) wystarcza dla stron signup/signin/confirm-email — nie uruchamiaj `supabase link` ani `supabase db push`, nie twórz żadnego pliku w `supabase/migrations/`. Reguła RLS z `AGENTS.md` dotyczy dopiero pierwszej własnej tabeli (np. `categories`), która nie istnieje w tym przejściu.
5. **`astro.config.mjs` `optional: true` — zostaw bez zmian.** Ten graceful-degradation jest celowym zachowaniem startera (pozwala `git clone && npm install && npm run dev` działać bez skonfigurowanego Supabase) i jest wymagany przez istniejący krok CI (`npm run build` z sekretami repo). Zamiana na `optional: false` złamałaby to zachowanie i nie jest potrzebna — ryzyko cichej pomyłki adresujemy w kroku weryfikacyjnym (Faza 5, punkt 5), nie zmianą schematu.

### Faza 1 — Przekazanie do USER (blokujące, synchroniczne)

6. **(USER)** Uruchom `wrangler login` we własnym terminalu (otwiera OAuth w przeglądarce). Daj znać agentowi po zakończeniu.
7. **(USER)** Załóż chmurowy projekt Supabase (panel w przeglądarce). Skopiuj:
   - Project URL (`https://<ref>.supabase.co`) → `SUPABASE_URL`
   - **anon/public key** (NIE `service_role` — ten ostatni omija RLS i nie powinien nigdzie trafić) → `SUPABASE_KEY`
   - Przy okazji: sprawdź w Auth settings, czy przełącznik "Confirm email" jest w stanie zgodnym z oczekiwaniami `confirm-email.astro` (starter domyślnie wymaga potwierdzenia mailem) — to jednoklikowa kontrola w panelu, nie zmiana kodu.
     Przekaż oba sekrety agentowi.

### Faza 2 — Lokalny smoke test (AGENT, po otrzymaniu danych z kroku 7)

8. Utwórz `.dev.vars` (gitignored) z otrzymanymi wartościami:
   ```
   SUPABASE_URL=<wartość od użytkownika>
   SUPABASE_KEY=<wartość od użytkownika>
   ```
9. Uruchom `npm run build` i `npm run preview` — potwierdź, że proces startuje bez błędu. **Uwaga**: z powodu graceful-degradation, build/preview przejdą nawet z błędnymi danymi — to nie jest dowód, że prawdziwe dane działają, tylko że build się nie wysypał. Właściwa weryfikacja auth flow następuje dopiero na żywym Workerze (Faza 5).

### Faza 3 — Sekrety produkcyjne (AGENT, nieinteraktywnie)

10. Ustaw sekrety produkcyjne przez `wrangler secret put`, podając wartość przez stdin (żeby uniknąć interaktywnego promptu), używając `Write-Output` (PowerShell) — **bez końcowego znaku nowej linii wpływającego na wartość** (sprawdzić czy PowerShell dodaje `\r\n` i w razie potrzeby użyć alternatywy bez tego efektu):
    ```powershell
    Write-Output "https://<ref>.supabase.co" | npx wrangler secret put SUPABASE_URL
    Write-Output "<anon-key>" | npx wrangler secret put SUPABASE_KEY
    ```
    Brak `[env.production]` w `wrangler.jsonc` (pojedyncze domyślne środowisko) — żadna z komend nie potrzebuje flagi `--env production`.
    **Uwaga o ujawnieniu sekretu**: wartość anon key przejdzie przez transkrypt wywołania narzędzia. Anon key jest z założenia publiczny (ląduje w bundlu klienckim), więc ryzyko jest niższe niż dla service_role key — mimo to zasygnalizuj to użytkownikowi przed wykonaniem, zamiast robić to po cichu.

### Faza 4 — Deploy (AGENT, po ustawieniu sekretów)

11. ```bash
    npm run build
    npx wrangler deploy
    ```
    (Deploy nie buduje automatycznie — `assets.directory` w `wrangler.jsonc` wskazuje na `./dist`, które istnieje dopiero po buildzie.) Pierwszy deploy może zapytać o rejestrację domyślnej subdomeny `workers.dev`, jeśli to nowe konto — obserwuj output pod kątem nieoczekiwanego promptu.

### Faza 5 — Weryfikacja

12. **Build lokalny przechodzi** — `npm run build` kończy się kodem 0, `dist/` jest wypełnione.
13. **Deploy zwraca działający URL** — stdout z `wrangler deploy` zawiera `https://my-budget.<subdomain>.workers.dev`; agent odpytuje ten URL (np. przez curl) i potwierdza HTTP 200 na `/`.
14. **Flow signup/signin działa na prawdziwym Supabase** — najlepiej wykonane przez USER w przeglądarce (wymaga odebrania/kliknięcia maila potwierdzającego): `/auth/signup` → potwierdzenie maila → `/auth/signin` → dostęp do `/dashboard` (potwierdza, że `middleware.ts` i sesja cookie działają na żywym Workerze, nie tylko lokalnie).
15. **`wrangler tail` pokazuje logi na żywo** — uruchom `npx wrangler tail`, odśwież deployowany URL, potwierdź strumieniowanie logów (potwierdza działanie `observability.enabled: true`).
16. **Kontrola cichej pomyłki (obowiązkowa)** — jawnie potwierdź, że wdrożona strona główna NIE pokazuje banera "Supabase nie jest skonfigurowany" z `config-status.ts`/`Welcome.astro`. Jeśli pokazuje — sekrety nie zostały poprawnie odczytane (np. błąd z końcową nową linią z kroku 10) mimo że sam deploy "się udał".

## Poza zakresem tego przejścia

- Brak spinania GitHub Actions / auto-deploy w CI (`.github/workflows/ci.yml` zostaje lint+build).
- Brak migracji Supabase, `supabase link`, `supabase db push`.
- Brak własnej domeny / konfiguracji DNS w Cloudflare.
- Brak bindings KV/D1/R2 w `wrangler.jsonc`.
- Brak `[env.production]` w `wrangler.jsonc`.
- Brak zmiany `optional: true` w `astro.config.mjs`.

## Wynik (2026-07-21)

Wdrożenie zakończone i w pełni zweryfikowane:

- **Live URL**: `https://my-budget.krzysztof-materla-dev.workers.dev` — HTTP 200, bez banera "Supabase nieskonfigurowany".
- **Bindings auto-provisioned przy deployu**: `env.SESSION` (KV Namespace), `env.IMAGES`, `env.ASSETS` — bez ręcznej konfiguracji w `wrangler.jsonc`.
- **`wrangler tail`** potwierdzony jako działający kanał logów na żywo.
- **Signup → potwierdzenie mailem → signin → `/dashboard`** zweryfikowane end-to-end przez użytkownika na produkcyjnym Workerze.

**Napotkany i rozwiązany gotcha (do zapamiętania dla przyszłych wdrożeń)**: link potwierdzający e-mail z Supabase Auth prowadził na `localhost`, bo `supabase.auth.signUp()` w `src/pages/api/auth/signup.ts` nie ustawia jawnie `emailRedirectTo` — Supabase używa wtedy **Site URL** z panelu projektu (Authentication → URL Configuration), który domyślnie wskazuje na `http://localhost:3000` dla nowych projektów. Naprawione ręcznie w panelu Supabase (Site URL + Redirect URLs zaktualizowane na `https://my-budget.krzysztof-materla-dev.workers.dev`). Świadomie NIE zmieniono kodu (`emailRedirectTo`) w tym przejściu — możliwa przyszła poprawka odporności, jeśli projekt zacznie mieć wiele środowisk (lokalny dev + produkcja) z różnymi URL-ami.

**Drobny artefakt bez wpływu na deploy**: lokalny katalog `dist/client` pozostał częściowo zablokowany (`EPERM`/device busy) po nieuprzątniętym procesie preview — nie wpłynęło to na sam deploy (assets zostały poprawnie wysłane wcześniej), ale lokalny `dist/` może wymagać ręcznego wyczyszczenia po restarcie terminala przed kolejnym buildem.

## Kluczowe pliki

- `C:\Sources\10x_budget\wrangler.jsonc`
- `C:\Sources\10x_budget\supabase\config.toml`
- `C:\Sources\10x_budget\.dev.vars` (do utworzenia, gitignored)
- `C:\Sources\10x_budget\astro.config.mjs` (bez zmian, tylko weryfikacja)
- `C:\Sources\10x_budget\src\lib\supabase.ts` (kontekst dla weryfikacji graceful-degradation)
