# Nabhya system diagrams

These diagrams describe the implementation in this repository as of October 2026.

> **Provider note:** the running system uses **Supabase Auth JWKS**, **Supabase PostgreSQL**, and **Supabase Storage**. It does **not** currently use Neon Auth or AWS S3. Supabase Storage fills the object-storage/S3 role in the architecture. `Razorpay` is the implemented payment provider and sends the payment webhook.
>
> The current Drizzle schema declares **29 tables**, rather than 22. The ER diagram therefore includes all 29 implemented tables.

## System architecture

```mermaid
flowchart LR
    subgraph Client[Client]
        Expo[Expo / React Native app]
    end

    subgraph Nabhya[Nabhya backend]
        API[NestJS API\nJWT/RBAC • validation]
        Drizzle[Drizzle ORM]
        API --> Drizzle
    end

    subgraph Supabase[Supabase]
        Auth[Auth\nJWT + JWKS]
        DB[(PostgreSQL)]
        Storage[Storage\nobject files]
    end

    Payment[Razorpay\npayments]

    Expo -->|HTTPS API + access token| API
    Expo -->|Sign in / sign up| Auth
    Auth -. JWKS .-> API
    Drizzle --> DB

    API -->|Signed URL| Storage
    Expo -->|Direct file upload / download| Storage

    API -->|Create order| Payment
    Expo -->|Native checkout| Payment
    Payment -->|Signed webhook| API
```

**Key:** solid arrows are requests or data transfers; the dashed JWKS arrow is the API retrieving signing keys to validate access tokens.

### Architecture flow notes

- The Expo app authenticates with Supabase Auth; NestJS verifies access tokens with the remote JWKS and JIT-syncs the user into `users`.
- Files are uploaded directly from the Expo app to Supabase Storage using API-issued signed URLs. Database tables retain storage **object keys**, not public URLs.
- The API computes donation amounts and creates a pending donation. The client-side Razorpay success callback does not complete it; only a valid Razorpay webhook may do so.
- In development without Supabase Storage credentials, the server can use an in-memory storage stub. That is not durable and is refused in production.

## Entity relationship diagram

**Legend:** `PK` = primary key; `FK` = database foreign key; `UK` = unique key. Attributes are intentionally limited to identifiers and relationship-bearing fields so the 29-table diagram remains readable.

```mermaid
erDiagram
    users {
        uuid id PK
        varchar auth_user_id UK
        varchar email UK
        verification_status verification_status
        user_status status
    }
    roles {
        uuid id PK
        varchar name UK
    }
    user_roles {
        uuid id PK
        uuid user_id FK
        uuid role_id FK
    }
    user_documents {
        uuid id PK
        uuid user_id FK
        uuid verified_by FK
        text document_key
    }

    organizations {
        uuid id PK
        uuid owner_user_id FK UK
        uuid reviewed_by FK
        varchar organization_name
        org_verification_status verification_status
    }
    organization_admins {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        uuid invited_by FK
        team_role role
        team_status status
    }
    team_invites {
        uuid id PK
        uuid organization_id FK
        uuid invited_by FK
        uuid accepted_by FK
        text token_hash UK
    }
    organization_ownership_transfers {
        uuid id PK
        uuid organization_id FK
        uuid from_member_id FK
        uuid to_member_id FK
        uuid requested_by FK
        uuid confirmed_by FK
        text token_hash UK
    }
    organization_documents {
        uuid id PK
        uuid organization_id FK
        uuid verified_by FK
        text document_key
    }

    categories {
        uuid id PK
        varchar slug UK
        varchar name
    }
    organization_categories {
        uuid id PK
        uuid organization_id FK
        uuid category_id FK
    }
    user_categories {
        uuid id PK
        uuid user_id FK
        uuid category_id FK
    }

    events {
        uuid id PK
        uuid organization_id FK
        uuid created_by FK
        event_status status
        timestamp start_at
    }
    event_applications {
        uuid id PK
        uuid event_id FK
        uuid volunteer_id FK
        uuid reviewed_by FK
        application_status status
        timestamp attended_at
    }
    needs {
        uuid id PK
        uuid organization_id FK
        uuid created_by FK
        need_type type
        need_status status
    }
    need_pledges {
        uuid id PK
        uuid need_id FK
        uuid user_id FK
        uuid reviewed_by FK
        pledge_status status
    }
    certificates {
        uuid id PK
        uuid application_id FK UK
        uuid event_id FK
        uuid volunteer_id FK
        uuid organization_id FK
        uuid issued_by FK
        varchar code UK
    }
    donations {
        uuid id PK
        uuid organization_id FK
        uuid donor_user_id FK
        varchar provider_payment_id UK
        donation_status status
    }

    bookmarks {
        uuid id PK
        uuid user_id FK
        uuid organization_id FK
    }
    follows {
        uuid id PK
        uuid user_id FK
        uuid organization_id FK
    }
    reviews {
        uuid id PK
        uuid user_id FK
        uuid organization_id FK
        integer rating
    }
    notifications {
        uuid id PK
        uuid user_id FK
        notification_type type
    }

    posts {
        uuid id PK
        uuid author_user_id FK
        uuid organization_id FK
        feed_item_type type
        varchar media_folder UK
    }
    posts_media {
        uuid id PK
        uuid post_id FK
        text object_key UK
    }
    post_interactions {
        uuid id PK
        uuid user_id FK
        uuid post_id
        feed_item_type target_type
        post_interaction_type interaction_type
    }
    post_comments {
        uuid id PK
        uuid user_id FK
        uuid post_id
        feed_item_type target_type
    }

    announcements {
        uuid id PK
        uuid organization_id FK
        uuid created_by FK
        announcement_status status
    }
    financial_reports {
        uuid id PK
        uuid organization_id FK
        uuid uploaded_by FK
        text document_key
    }
    audit_logs {
        uuid id PK
        uuid performed_by FK
        varchar action
        uuid entity_id
    }

    users ||--o{ user_roles : has
    roles ||--o{ user_roles : grants
    users ||--o{ user_documents : uploads
    users o|--o{ user_documents : verifies

    users ||--o| organizations : owns
    users o|--o{ organizations : reviews
    organizations ||--o{ organization_admins : has
    users ||--o{ organization_admins : joins
    users o|--o{ organization_admins : invites
    organizations ||--o{ team_invites : issues
    users o|--o{ team_invites : sends
    users o|--o{ team_invites : accepts
    organizations ||--o{ organization_ownership_transfers : has
    organization_admins ||--o{ organization_ownership_transfers : from_member
    organization_admins ||--o{ organization_ownership_transfers : to_member
    users o|--o{ organization_ownership_transfers : requests_or_confirms
    organizations ||--o{ organization_documents : owns
    users o|--o{ organization_documents : verifies

    organizations ||--o{ organization_categories : classified_by
    categories ||--o{ organization_categories : classifies
    users ||--o{ user_categories : interested_in
    categories ||--o{ user_categories : interest

    organizations ||--o{ events : publishes
    users o|--o{ events : creates
    events ||--o{ event_applications : receives
    users ||--o{ event_applications : applies
    users o|--o{ event_applications : reviews
    organizations ||--o{ needs : publishes
    users o|--o{ needs : creates
    needs ||--o{ need_pledges : receives
    users ||--o{ need_pledges : makes
    users o|--o{ need_pledges : reviews
    event_applications ||--o| certificates : earns
    events ||--o{ certificates : belongs_to
    users ||--o{ certificates : awarded_to
    organizations ||--o{ certificates : issues
    users o|--o{ certificates : issues_as
    organizations ||--o{ donations : receives
    users o|--o{ donations : makes

    users ||--o{ bookmarks : bookmarks
    organizations ||--o{ bookmarks : is_bookmarked
    users ||--o{ follows : follows
    organizations ||--o{ follows : is_followed
    users ||--o{ reviews : writes
    organizations ||--o{ reviews : receives
    users ||--o{ notifications : receives

    users ||--o{ posts : authors
    organizations o|--o{ posts : publishes
    posts ||--o{ posts_media : contains
    users ||--o{ post_interactions : performs
    users ||--o{ post_comments : writes
    organizations ||--o{ announcements : publishes
    users o|--o{ announcements : creates
    organizations ||--o{ financial_reports : publishes
    users o|--o{ financial_reports : uploads
    users o|--o{ audit_logs : performs
```

### ERD relationship constraints

- `user_roles`, `organization_categories`, and `user_categories` are many-to-many join tables. Their composite unique indexes prevent duplicate assignments.
- `event_applications` is unique on `(event_id, volunteer_id)`; `need_pledges` is unique on `(need_id, user_id)`; both enforce one active logical response per volunteer.
- `certificates.application_id` is unique, so an event application can have at most one certificate.
- `organization_admins` models team membership. Its partial unique indexes enforce one active owner per organization and one active owner organization per user.
- `post_interactions.post_id` and `post_comments.post_id` are **polymorphic references**, not foreign keys: `target_type` selects `posts`, `events`, `needs`, or `announcements`. The API verifies target existence and visibility.
- `audit_logs.entity_id` and `notifications.entity_id` are also polymorphic application references, so they are intentionally not database foreign keys.

## Use-case diagram

```mermaid
flowchart LR
    Anonymous[Anonymous visitor]
    Volunteer[Volunteer]
    Organisation[Organisation / team member]
    Superadmin[Superadmin]

    subgraph Nabhya[Nabhya platform]
        UC1([Browse public NGO directory, events, needs and feed])
        UC2([Search and filter public content])
        UC3([Verify a certificate by public code])
        UC4([Make a guest donation])
        UC5([Sign up, sign in and choose role])
        UC6([Complete volunteer onboarding and identity verification])
        UC7([Follow or bookmark NGOs; react, save, share and comment])
        UC8([Apply to events and pledge to needs])
        UC9([Donate and view donation history])
        UC10([Write organisation reviews])
        UC11([View notifications and certificates])
        UC12([Register NGO and submit verification documents])
        UC13([Manage organisation profile and team])
        UC14([Create and manage events, needs, posts and announcements])
        UC15([Review applications and pledges; record attendance])
        UC16([Issue or revoke certificates])
        UC17([Publish financial reports; view donations and overview])
        UC18([Review user, NGO and document verification])
        UC19([Suspend or manage users and organisations])
        UC20([Manage categories, audit logs, donations and analytics])
        UC21([Broadcast in-app notifications])
    end

    Anonymous --> UC1
    Anonymous --> UC2
    Anonymous --> UC3
    Anonymous --> UC4
    Anonymous --> UC5

    Volunteer --> UC1
    Volunteer --> UC2
    Volunteer --> UC6
    Volunteer --> UC7
    Volunteer --> UC8
    Volunteer --> UC9
    Volunteer --> UC10
    Volunteer --> UC11

    Organisation --> UC5
    Organisation --> UC12
    Organisation --> UC13
    Organisation --> UC14
    Organisation --> UC15
    Organisation --> UC16
    Organisation --> UC17
    Organisation --> UC11

    Superadmin --> UC18
    Superadmin --> UC19
    Superadmin --> UC20
    Superadmin --> UC21
    Superadmin --> UC11

    UC6 -. approved identity enables .-> UC8
    UC15 -. attended application enables .-> UC16
    UC18 -. verification decision notifies .-> UC11
```

## Chapter 5 — Testing architecture diagram

```mermaid
flowchart TB
    Command[Developer / CI\npnpm --filter server test]
    Vitest[Vitest\napps/server/vitest.config.ts]
    Env[Test environment\ntest/setup-env.ts\nthrowaway validated values]
    Specs[Integration specs\napps/server/test/*.spec.ts]
    Units[Unit specs\nsource-adjacent *.spec.ts]
    Harness[Test harness\ntest/harness.ts]
    Factories[Row factories\ntest/factories.ts]
    Migrations[Committed Drizzle migrations\npackages/db/src/migrations]
    PGlite[(PGlite\nPostgreSQL in WASM\nin-process)]
    Nest[NestJS application / services\ncontrollers, guards, modules]
    DatabaseModule[DatabaseModule\nDrizzle DB token]

    Command --> Vitest
    Vitest --> Env
    Vitest --> Specs
    Vitest --> Units

    Specs --> Harness
    Specs --> Factories
    Harness --> Migrations
    Migrations -->|Build test schema| PGlite
    Harness -->|Boot with test database| Nest
    Factories -->|Create deterministic fixtures| PGlite
    Nest --> DatabaseModule
    DatabaseModule -->|Drizzle queries| PGlite

    Units -. isolate and test .-> Nest
```

### Testing characteristics

- Integration tests use the real NestJS modules and a real PostgreSQL-compatible engine (`PGlite`), not a mocked database.
- `test/harness.ts` constructs the test database from the committed Drizzle migrations. This makes schema/migration drift fail tests.
- `test/factories.ts` creates valid rows and relationship graphs for endpoint scenarios.
- `test/setup-env.ts` supplies throwaway environment values before imports that validate server configuration.
- `verify:di` is a complementary server check: it resolves controllers and services to catch missing explicit NestJS `@Inject(...)` dependencies.

## Chapter 6 — Deployment diagram

```mermaid
flowchart TB
    subgraph Device[User device]
        Expo[Expo native application]
        Browser[Public browser / certificate verifier]
    end

    subgraph Edge[Internet edge]
        Proxy[Reverse proxy / load balancer\nTLS termination]
    end

    subgraph Runtime[Application runtime]
        API[NestJS API instance\nport 3000 • /api]
        Cron[Scheduler\nhourly job]
    end

    subgraph Supabase[Supabase]
        Auth[Supabase Auth\nJWT issuer + JWKS]
        DB[(Supabase PostgreSQL)]
        Storage[Supabase Storage\nS3-style object storage]
    end

    Razorpay[Razorpay payment platform]

    Expo -->|HTTPS REST + Bearer token| Proxy
    Browser -->|Public HTTPS requests| Proxy
    Proxy -->|Forward to port 3000| API

    Expo -->|Sign in / sign up| Auth
    API -->|Fetch public JWKS; verify JWT| Auth
    API -->|Drizzle / PostgreSQL connection| DB

    API -->|Issue signed upload/download URLs| Storage
    Expo -->|Direct signed object PUT / GET| Storage

    Expo -->|Start native checkout| Razorpay
    API -->|Create order| Razorpay
    Razorpay -->|Signed POST /api/donations/webhook| Proxy
    Proxy --> API
    API -->|Persist verified completion| DB

    Cron -->|POST /api/admin/events/close-finished| Proxy
    API -->|Close finished events| DB
```

### Deployment notes

- The proxy/load balancer should use `GET /api/health` as its readiness probe because it verifies database connectivity. `GET /api` is liveness only.
- `trust proxy` is enabled only in production, where the API expects a proxy in front of it.
- Supabase Storage is the deployed object-store provider; it provides the role often labelled “S3” in a deployment diagram. The API never proxies file bytes.
- The scheduler must invoke `POST /api/admin/events/close-finished` (hourly is sufficient). It is the process that changes completed events out of `PUBLISHED`.
- The Razorpay webhook must retain the exact raw request body so its signature can be verified before any donation is marked `COMPLETED`.
