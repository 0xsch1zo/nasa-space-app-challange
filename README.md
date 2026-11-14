# AstroHealth — dashboard zdrowia załogi stacji kosmicznej

Full-stackowy dashboard, który agreguje parametry zdrowotne astronautów (ciśnienie krwi,
gęstość kości, zanik mięśni, tętno spoczynkowe) i pokazuje je na wykresach czasowych oraz
na mapie ciała.

* **Backend:** Rust, architektura heksagonalna (porty i adaptery), workspace z osobnymi crate'ami.
* **Frontend:** React + TypeScript, Mantine.

**Główny cel architektoniczny to modularność.** Parametr zdrowotny jest *daną* (deklaratywną
definicją), a nie kodem rozrzuconym po warstwach. Dodanie nowego parametru to jeden plik
i jedna linia. Szczegóły w sekcji [Jak dodać nowy parametr](#jak-dodać-nowy-parametr-zdrowotny).

| Profil zdrowotny (widok nadzoru, karta astronauty) | Lista załogi (konto nadzorujące) |
|---|---|
| ![profil](docs/profile.png) | ![załoga](docs/crew.png) |

---

## Szybki start

```bash
docker compose up --build
```

| Usługa | Adres | Opis |
|---|---|---|
| frontend | http://localhost:3000 | nginx serwuje SPA i przekazuje `/api` do backendu |
| backend | http://localhost:8080/api | REST API (axum) |
| db | localhost:5432 | PostgreSQL 16 (`astro` / `astro`, baza `astro_health`) |

Usługa `seed` uruchamia się raz przed backendem. Wykonuje migracje, tworzy partycje
parametrów i ładuje dane demonstracyjne (kilka miesięcy historii). Jeśli dane już istnieją,
pomija ten krok. Dane są generowane względem bieżącej daty. Żeby je odświeżyć:

```bash
docker compose run --rm seed seed --reset
```

### Konta demonstracyjne (hasło dla wszystkich: `orbita2026`)

| Login | Rola | Stacja | Co widać |
|---|---|---|---|
| `lekarz.aurora` | nadzorujący | Stacja Orbitalna Aurora | 4 astronautów stacji Aurora |
| `lekarz.selene` | nadzorujący | Lunar Gateway Selene | 1 astronautę stacji Selene |
| `anna.kowalska` | astronautka | Aurora | tylko siebie (zanik mięśni łydki: stan krytyczny) |
| `marcus.reyes` | astronauta | Aurora | tylko siebie (podwyższone ciśnienie) |
| `yuki.tanaka`, `lena.hoffmann` | astronauci | Aurora | tylko siebie |
| `omar.haddad` | astronauta | Selene | tylko siebie |

Postacie i stacje są fikcyjne.

### Uruchomienie deweloperskie (bez Dockera dla aplikacji)

```bash
docker compose up -d db
cd backend
export DATABASE_URL=postgres://astro:astro@localhost:5432/astro_health JWT_SECRET=dev
cargo run --bin seed            # migracje + dane demo
cargo run --bin server          # API na :8080
cargo test                      # testy domeny, przypadków użycia i JWT

cd ../frontend
npm install
npm run dev                     # http://localhost:5173 (proxy /api → :8080)
```

Zmienne backendu: `DATABASE_URL` (wymagana), `JWT_SECRET`, `JWT_TTL_MINUTES` (480),
`BIND_ADDR` (`0.0.0.0:8080`), `CORS_ORIGINS` (`http://localhost:5173`), `RUST_LOG`.

---

## Wybory technologiczne

| Obszar | Wybór | Uzasadnienie |
|---|---|---|
| HTTP w Rust | **axum** (+ tokio, tower-http) | Najpowszechniejszy framework ekosystemu tokio. Ma ekstraktory typowane, a `FromRequestParts` daje czysty punkt na uwierzytelnianie. |
| Baza danych | **PostgreSQL 16** | Dojrzała baza z partycjonowaniem deklaratywnym (osobna partycja na agregat parametru), `JSONB` na składowe pomiaru i `date_bin` do agregacji szeregów czasowych. |
| Dostęp do DB | **sqlx** | Asynchroniczny driver SQL bez ORM, z wbudowanymi migracjami. Pełna kontrola nad zapytaniami czasowymi. |
| Auth | **jsonwebtoken** (HS256) + **argon2** | Standardowe crate'y do JWT i do hashowania haseł (Argon2 to rekomendacja OWASP). |
| UI | **Mantine 8** | Kompletna biblioteka komponentów React z pierwszorzędnym wsparciem TS i ciemnym motywem. Ma też własny pakiet wykresów, więc całe UI pochodzi z jednej biblioteki. |
| Wykresy | **@mantine/charts** (na **Recharts 3**) | Wykresy spójne stylistycznie z Mantine. Recharts jest najczęściej używaną biblioteką wykresów dla Reacta. |
| Dane po stronie klienta | **TanStack Query** | Standard cache'owania i synchronizacji danych serwerowych. Każdy widget pobiera dane niezależnie. |
| Wizualizacja ciała | **2D SVG (przód/tył)** | Model 3D (three.js, rigging, mapowanie regionów) byłby nieproporcjonalnie kosztowny. Schemat 2D jest czytelniejszy klinicznie i równie łatwo rozszerzalny o nowe regiony. |

---

## Architektura

```
                ┌──────────────────────── driving adapters ─────────────────────────┐
                │  adapter-http (axum)        seed binary / przyszły gateway urządzeń │
                └──────────────┬───────────────────────────────┬────────────────────┘
                               │ ports::inbound                │ MeasurementIngestion
                ┌──────────────▼───────────────────────────────▼────────────────────┐
                │ application: AuthService, CrewService, HealthService,             │
                │              IngestionService, AccessPolicy (autoryzacja)         │
                │ ┌───────────────────────────────────────────────────────────────┐ │
                │ │ domain: MetricDefinition / MetricCatalog, MetricHistory,      │ │
                │ │         ocena statusu, body_map, Astronaut/User/Role          │ │
                │ └───────────────────────────────────────────────────────────────┘ │
                └──────────────┬───────────────────────────────┬────────────────────┘
                               │ ports::outbound               │
                ┌──────────────▼──────────────┐  ┌─────────────▼────────────────────┐
                │ adapter-postgres (sqlx)     │  │ adapter-auth (JWT, Argon2)       │
                └─────────────────────────────┘  └──────────────────────────────────┘
                                 server = composition root (wiring, config)
```

Kierunek zależności **wymusza kompilator**, bo każda warstwa to osobny crate:

| Crate | Zależy od | Zawartość |
|---|---|---|
| `domain` | tylko `chrono`, `uuid`, `thiserror` | Model, definicje parametrów, walidacja, klasyfikacja, mapa ciała |
| `application` | `domain` | Porty (traity), przypadki użycia, polityka dostępu, testy z adapterami in-memory |
| `adapter-postgres` | `application`, `domain`, sqlx | Repozytoria i migracje |
| `adapter-auth` | `application`, `domain` | `TokenService` (JWT), `PasswordHasher` (Argon2) |
| `adapter-http` | `application`, `domain`, axum | Routing, DTO, mapowanie błędów. Brak logiki biznesowej |
| `server` | wszystko | `main` (API) i `bin/seed` |

### Warstwa HTTP

`adapter-http` tylko mapuje żądania na porty wejściowe (`AuthUseCase`, `CrewUseCase`,
`HealthUseCase`). Ekstraktor `Auth` weryfikuje token i przekazuje `Principal` do przypadku
użycia. Nie podejmuje decyzji o dostępie.

| Metoda | Ścieżka | Opis |
|---|---|---|
| POST | `/api/auth/login` | `{username, password}` → `{token, expiresAt, user}` |
| GET | `/api/me` | Zalogowany użytkownik |
| GET | `/api/metrics` | Katalog parametrów (składowe, jednostki, zakresy referencyjne, region ciała) |
| GET | `/api/astronauts` | Załoga stacji ze statusami (tylko konta nadzorujące) |
| GET | `/api/astronauts/{id}` | Podsumowanie astronauty |
| GET | `/api/astronauts/{id}/overview` | Najnowsze wartości, statusy i mapa ciała |
| GET | `/api/astronauts/{id}/metrics/{code}/series?from&to&bucket=hour\|day\|week` | Szereg czasowy |

### Autoryzacja (JWT)

* Token HS256 zawiera `sub`, `role`, `station_id` i `astronaut_id` (tylko dla astronautów),
  a także `iss` i `exp`. Token niespójny z modelem ról jest odrzucany.
* Reguły są w jednym miejscu, w `application/src/security.rs` (`AccessPolicy`):
  * **astronauta** widzi wyłącznie profil o własnym `astronaut_id`,
  * **nadzorujący** widzi wszystkich astronautów **swojej stacji** i nikogo spoza niej.
* Reguły są egzekwowane **wewnątrz przypadków użycia** (`Authorizer::astronaut_visible_to`,
  `AccessPolicy::can_list_crew`), a nie w routingu. Nowa trasa HTTP albo inny adapter
  (np. gRPC) nie ominie ich, bo nie da się pobrać danych z pominięciem przypadku użycia.
  Testy w `application/src/services/tests.rs` sprawdzają to bez HTTP i bez bazy.
* Frontend dopasowuje interfejs do roli (`RequireRole`), ale to tylko wygoda. Granicą
  bezpieczeństwa jest backend (zwraca 403, a bez tokena 401).

### Baza danych: agregaty historyczne

Agregatem jest **historia jednego parametru dla jednego astronauty** (`MetricHistory`).
Domena waliduje każdy pomiar względem definicji parametru: komplet składowych, brak
nieznanych składowych i fizjologicznie wiarygodny zakres. Dopiero potem repozytorium
dopisuje pomiar.

```sql
measurements (metric_code, astronaut_id, recorded_at, components JSONB, source, ...)
  PRIMARY KEY (metric_code, astronaut_id, recorded_at)
  PARTITION BY LIST (metric_code)
    ├── measurements_blood_pressure
    ├── measurements_bone_density
    ├── measurements_muscle_atrophy
    └── measurements_heart_rate          ← tworzona automatycznie przy starcie

latest_measurements (astronaut_id, metric_code, recorded_at, components)   -- projekcja
  PRIMARY KEY (astronaut_id, metric_code)
```

* **Każdy parametr ma fizycznie osobną partycję.** Aplikacja tworzy ją przy starcie na
  podstawie katalogu (`MeasurementRepository::ensure_storage`), więc nowy parametr nie
  wymaga migracji.
* **Szereg czasowy** to zakres po kluczu głównym (`metric_code`, `astronaut_id`,
  `recorded_at`), z przycinaniem do jednej partycji. Opcjonalny `bucket` uśrednia każdą
  składową w oknach (`date_bin` + `jsonb_each_text`). Zapytanie jest generyczne i działa
  dla każdego parametru.
* **Najnowsza wartość** to jeden wiersz w `latest_measurements`, aktualizowany w tej samej
  transakcji co zapis historii (upsert tylko, gdy pomiar jest nowszy). Przegląd, lista
  załogi i mapa ciała czytają po jednym wierszu na parametr.
* `components` w `JSONB` ma kształt gotowy do wykresu, np. `{"systolic": 118, "diastolic": 76}`.
  Schemat tych danych pilnuje domena, nie baza.

### Przyjmowanie danych z urządzeń

Port wejściowy `MeasurementIngestion::ingest(Vec<DeviceMeasurement>) -> IngestReport`
(`application/src/ports/inbound.rs`) waliduje dane w domenie i zwraca raport z pomiarami
przyjętymi i odrzuconymi. Prawdziwa integracja (MQTT, HL7/FHIR, mostek szeregowy) będzie
kolejnym adapterem wywołującym ten port.

Na razie jedynym klientem portu jest **seeder** (`backend/crates/server/src/bin/seed.rs`).
Generuje on realistyczną historię: ciśnienie codziennie rano, densytometria i USG mięśni
co tydzień. Drift fizjologiczny jest typowy dla mikrograwitacji (około 1–1,5% BMD na
miesiąc, zanik łydki szybszy niż uda). Każdy astronauta ma indywidualny profil ryzyka.
Seeder przechodzi przez ten sam port co urządzenia, więc dane demo podlegają tej samej
walidacji.

### Frontend: modularny dashboard

```
frontend/src/
  api/          klient fetch z tokenem, typy DTO, hooki TanStack Query
  auth/         AuthContext (login, wylogowanie przy 401, trwała sesja), RequireRole
  pages/        LoginPage, MyProfilePage (astronauta), SupervisorPage (karty)
  components/   AppLayout, HealthProfile, CrewTable, StatusBadge, ...
  dashboard/
    registry.tsx      ← rejestr widgetów: jedyne miejsce, z którego dashboard wie, co rysować
    Dashboard.tsx     siatka renderująca moduły z rejestru
    widgets/          BodyMapWidget, AttentionWidget, MetricChartWidget (generyczny),
                      BloodPressureWidget (przykład widgetu dedykowanego), MetricChart
```

* Każdy widget to niezależny moduł `WidgetModule { id, span, Component }`, który sam pobiera
  swoje dane.
* Widgety przekrojowe (mapa ciała, „Wymaga uwagi”) są w `profileWidgets`.
* **Każdy parametr z katalogu automatycznie dostaje widget.** Domyślnie jest to generyczny
  `MetricChartWidget`: seria na każdą składową, linie referencyjne z zakresów klinicznych
  i typ wykresu z definicji. Dedykowany widget rejestruje się jedną linią
  w `metricWidgetOverrides`, jak `blood_pressure` → `BloodPressureWidget`.
* Mapa ciała koloruje regiony według `bodyRegion` składowych, a kolumny tabeli załogi
  pochodzą z katalogu. Nowy parametr pojawia się w obu miejscach sam.
* **Astronauta** widzi tylko `/me`, czyli swój profil. **Nadzorujący** ma kartę „Załoga”
  (tabela ze statusami per parametr, posortowana od najgorszego) i otwiera profile
  astronautów w zamykanych kartach (`/crew/:id`).

---

## Jak dodać nowy parametr zdrowotny

Na przykładzie tętna spoczynkowego, dodanego w osobnym commicie
(`git show HEAD~1 --stat`, commit *„Add resting heart rate metric”*):

```
 backend/crates/domain/src/metrics/catalog.rs                  |  1 +
 backend/crates/domain/src/metrics/definitions/heart_rate.rs   | 22 ++++++++
 backend/crates/domain/src/metrics/definitions/mod.rs          |  1 +
```

**1. Definicja** w `backend/crates/domain/src/metrics/definitions/heart_rate.rs`:

```rust
pub fn definition() -> MetricDefinition {
    MetricDefinition::builder("heart_rate", "Tętno spoczynkowe")
        .description("Spoczynkowa częstość akcji serca mierzona rano przez opaskę.")
        .chart(ChartKind::Line)
        .sampling_hours(24)
        .component(ComponentDefinition::new(
            "resting", "Tętno", "bpm",
            BodyRegion::Heart,                 // gdzie pokazać na mapie ciała
            Bounds::between(25.0, 220.0),      // zakres wiarygodny (walidacja urządzeń)
            Bounds::between(50.0, 90.0),       // norma
            Bounds::between(45.0, 100.0),      // ostrzeżenie (poza nim: krytyczny)
            0,                                 // miejsca po przecinku
            DemoSignal { baseline: 62.0, spread: 5.0, drift_per_day: 0.02, noise: 3.0 },
        ))
        .build()
}
```

**2. Rejestracja**: `pub mod heart_rate;` w `definitions/mod.rs` i jedna linia
w `MetricCatalog::builtin()`.

To wszystko. Po restarcie backendu bez żadnych dodatkowych kroków działa:

| Element | Skąd się bierze |
|---|---|
| partycja `measurements_heart_rate` | `ensure_storage` przy starcie, **bez migracji** |
| walidacja pomiarów z urządzeń | `MetricHistory::record` na podstawie definicji |
| status norma/ostrzeżenie/krytyczny | `MetricDefinition::assess` |
| region „Serce” na mapie ciała | `body_map` + `bodyRegion` |
| endpointy `/series` i `/overview` | generyczne repozytorium i DTO |
| widget z wykresem i liniami referencyjnymi | generyczny `MetricChartWidget`, **bez zmian we frontendzie** |
| kolumna w tabeli załogi | katalog `/api/metrics` |
| dane demo | generyczny symulator seedera (`DemoSignal`), po `seed --reset` |

Opcjonalnie można dodać dedykowaną wizualizację: komponent w `frontend/src/dashboard/widgets/`
i jedna linia w `metricWidgetOverrides`. Nowy region ciała wymaga wariantu w `BodyRegion`
i kształtu w `BodyFigure.tsx`.

> **Kompromis:** `DemoSignal` (parametry symulacji) leży w definicji parametru, choć używa
> go tylko seeder. Dzięki temu nowy parametr to naprawdę jeden plik, zgodnie z priorytetem
> modularności. W produkcji można to pole przenieść do konfiguracji seedera.

---

## Testy

```bash
cd backend && cargo test     # domena, przypadki użycia (polityka dostępu, ingest), JWT/Argon2
cd frontend && npm run build # typecheck + build produkcyjny
```

Testy przypadków użycia działają na adapterach in-memory. Pokazują, że rdzeń heksagonu
nie zależy od HTTP ani od bazy.

## Dalszy rozwój

* Prawdziwy adapter urządzeń (np. MQTT/FHIR) jako nowy driving adapter portu `MeasurementIngestion`.
* Refresh tokeny i rotacja kluczy (np. RS256 + JWKS) za tym samym portem `TokenService`.
* Alerty push przy przejściu w stan krytyczny, jako kolejny konsument zdarzenia zapisu pomiaru.
