# Architecture Diagram

Nabhya is a verified NGO and volunteer platform. The diagrams below show the primary user journeys and the current client, API, data, and integration boundaries.

## User Flow

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
~~~mermaid
flowchart TD
    Start(("Visitor"))
    Auth["Sign up or sign in"]
    Role["Choose role"]
    Volunteer["Volunteer onboarding"]
    Organisation["Organisation onboarding"]
    VerifyIdentity["Upload ID and liveness selfie"]
    Browse["Browse feed, NGOs, events and needs"]
    Apply["Apply to event or pledge a need"]
    Donate["Donate through Razorpay"]
    Certificate["Attend event and receive certificate"]
    Register["Register NGO and upload legal documents"]
    Approval["Superadmin reviews NGO and documents"]
    Publish["Publish events, needs, posts and reports"]
    Manage["Manage applicants, pledges, team and transparency"]
    Admin["Superadmin console"]
    PublicCertificate["Verify certificate publicly"]

    Start --> Auth
    Auth --> Role
    Role --> Volunteer
    Role --> Organisation
    Volunteer --> VerifyIdentity
    VerifyIdentity --> Browse
    Browse --> Apply
    Browse --> Donate
    Apply --> Certificate
    Certificate --> PublicCertificate
    Organisation --> Register
    Register --> Approval
    Approval --> Publish
    Publish --> Browse
    Publish --> Manage
    Admin --> Approval
    Admin --> Manage
    Donate --> PublicCertificate
~~~

## Application Architecture

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
~~~mermaid
flowchart TD
    subgraph ClientLayer["Client Layer"]
        Native["Expo SDK 58 React Native"]
        Router["Expo Router screens"]
        State["Zustand and TanStack Query"]
    end
    subgraph ApiLayer["API Layer"]
        Api["NestJS 11 REST API"]
        Guards["Throttling JWT and role guards"]
        Validation["Shared Zod validation"]
        Modules["Domain modules"]
    end
    subgraph DataLayer["Data Layer"]
        Drizzle["Drizzle ORM"]
        Postgres[("Supabase Postgres")]
        Pglite[("PGlite test database")]
    end
    subgraph ExternalLayer["External Services"]
        SupabaseAuth["Supabase Auth and JWKS"]
        SupabaseStorage["Supabase Storage"]
        Razorpay["Razorpay payments"]
        Resend["Resend email"]
    end

    Native --> Router
    Router --> State
    State -->|"HTTP requests"| Api
    Api --> Guards
    Guards --> Validation
    Validation --> Modules
    Modules --> Drizzle
    Drizzle -->|"SQL queries"| Postgres
    Modules -.->|"integration tests"| Pglite
    Guards -->|"JWT verification"| SupabaseAuth
    Modules -->|"signed upload URLs"| SupabaseStorage
    Modules -->|"orders and webhook verification"| Razorpay
    Modules -->|"transactional email"| Resend
~~~

### Technology Stack Summary

| Layer | Technology | Version | Purpose |
|---|---|---:|---|
| Client | Expo and React Native | SDK 58, RN 0.88 | Android and Expo Web application |
| Client | Expo Router | 58.x | File-based navigation and role-based route groups |
| Client | TanStack Query and Zustand | 5.x | Server cache and persisted auth state |
| API | NestJS and Express | 11.x | REST controllers, modules, guards and interceptors |
| API | Zod and shared schemas | Current workspace | Runtime request and response contracts |
| Data | Drizzle ORM | 0.45.x | Typed SQL access to PostgreSQL |
| Database | Supabase Postgres | Managed | Production relational persistence |
| Testing | PGlite and Vitest | 0.5.x and 4.x | In-process PostgreSQL-compatible integration tests |
| Authentication | Supabase Auth and jose | Current workspace | Authentication and remote JWKS JWT verification |
| Storage | Supabase Storage | Managed | Private documents, media, receipts and certificates |
| Payments | Razorpay | Native SDK and API | Donation checkout and signature-verified webhooks |
| Email | Resend | API integration | Team invites and donation receipts |
| Monorepo | pnpm and Turborepo | pnpm 10, Turbo 2 | Workspace dependency and task orchestration |

### Data Storage & External Services

Supabase Postgres stores users, roles, organizations, events, needs, applications, pledges, donations, certificates, publishing records, engagement data, notifications, and audit logs. Drizzle provides the typed persistence layer, while PGlite supplies a real PostgreSQL-compatible test database without Docker. Supabase Auth supplies identity and signing keys, and Supabase Storage holds private uploaded objects referenced by storage keys. Razorpay handles payment checkout and webhooks; Resend handles transactional email. Development can use an in-memory storage provider when Supabase Storage credentials are absent.

### Key Architectural Decisions

- Uses a modular NestJS API with global throttling, JWT authentication, role authorization, Zod validation, response transformation, and exception handling.
- Keeps organization-scoped operations server-derived from the authenticated user rather than accepting an organization identifier from the client.
- Uses signed object-storage uploads so file bytes bypass the API, and uses webhook signature verification as the only path that completes a donation.

## Component Relationships

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
~~~mermaid
flowchart LR
    subgraph PresentationLayer["Presentation"]
        cScreens["Expo Router screens"]
        cForms["React Hook Form"]
        cHooks["Query and auth hooks"]
        cCards["Feed and admin components"]
    end
    subgraph BusinessLayer["Business Logic"]
        cControllers["NestJS controllers"]
        cOrg["Organization services"]
        cFeed["Feed ranking and engagement"]
        cEvents["Event and need services"]
        cAdmin["Admin and verification services"]
        cPayments["Donation service"]
    end
    subgraph DataAccessLayer["Data Access"]
        cSchemas["Shared Zod schemas"]
        cDrizzle["Drizzle database client"]
        cStorage["Storage service"]
        cMail["Mail service"]
    end
    subgraph InfrastructureLayer["Infrastructure"]
        cGuards["Throttler JWT and role guards"]
        cAudit["Audit service"]
        cNotify["Notification service"]
        cProviders["Supabase Razorpay and Resend"]
    end

    cScreens --> cHooks
    cForms --> cHooks
    cCards --> cHooks
    cHooks -->|"REST calls"| cControllers
    cControllers -->|"validated input"| cSchemas
    cControllers --> cOrg
    cControllers --> cFeed
    cControllers --> cEvents
    cControllers --> cAdmin
    cControllers --> cPayments
    cOrg -->|"queries"| cDrizzle
    cFeed -->|"queries and ranking data"| cDrizzle
    cEvents -->|"transactions"| cDrizzle
    cAdmin -->|"queries and reviews"| cDrizzle
    cPayments -->|"donation records"| cDrizzle
    cOrg -->|"documents and media"| cStorage
    cPayments -->|"receipts"| cMail
    cPayments -->|"payment provider"| cProviders
    cStorage --> cProviders
    cMail --> cProviders
    cGuards -.->|"intercepts requests"| cControllers
    cOrg -.->|"records actions"| cAudit
    cAdmin -.->|"emits decisions"| cNotify
    cNotify --> cDrizzle
~~~

### Component Inventory

| Component | Layer | Type | Responsibility |
|---|---|---|---|
| Expo Router screens | Presentation | Routes | Renders public, volunteer, NGO and admin flows |
| Query and auth hooks | Presentation | Client state | Calls typed API services and manages cached server state |
| Feed and admin components | Presentation | UI components | Presents ranked feed cards and data-console views |
| NestJS controllers | Business Logic | REST controllers | Exposes the `/api` route surface and maps requests to services |
| Organization services | Business Logic | Domain services | Resolves organization membership, profiles, verification and scoping |
| Feed ranking and engagement | Business Logic | Domain services | Builds ranked feeds and handles likes, saves, shares and comments |
| Event and need services | Business Logic | Domain services | Manages events, applications, needs and pledges with locked counters |
| Admin and verification services | Business Logic | Domain services | Reviews users and NGOs, manages audit operations and analytics |
| Donation service | Business Logic | Domain service | Creates payment orders and finalizes donations from verified webhooks |
| Shared Zod schemas | Data Access | Contract layer | Validates client and server payloads from one shared definition |
| Drizzle database client | Data Access | ORM client | Executes typed SQL against the relational schema |
| Storage service | Data Access | Provider abstraction | Creates signed upload and download URLs and checks uploaded objects |
| Mail service | Data Access | Provider abstraction | Sends team invitations and donation receipts |
| Throttler JWT and role guards | Infrastructure | Cross-cutting guards | Rate-limits requests and enforces authentication and roles |
| Audit service | Infrastructure | Cross-cutting service | Records administrative and business actions without blocking transactions |
| Notification service | Infrastructure | Cross-cutting service | Creates in-app notifications for team and verification events |
| Supabase Razorpay and Resend | Infrastructure | External providers | Supplies identity, storage, payments and transactional email |
