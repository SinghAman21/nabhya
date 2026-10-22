
## Overview

A relational database for an NGO platform supporting: - User
authentication & verification - NGO management - Volunteer & event
management - Donations - Reviews & bookmarks - Notifications - Financial
reports - Audit logs - Password/email verification

## Core Entities

-   **User**
-   **Organization**
-   **Category**
-   **Donation**
-   **Event**
-   **VolunteerApplication**
-   **Certificate**
-   **Notification**
-   **Announcement**
-   **FinancialReport**
-   **AuditLog**
-   **PasswordResetToken**
-   **EmailVerificationToken**
-   **UserVerificationDocument**
-   **OrganizationDocument**
-   **OrganizationAdmin**
-   **OrganizationCategory**
-   **Bookmark**
-   **Review**

## Vertical Relationship Diagram

``` mermaid
flowchart TD

User --> UserVerificationDocument
User --> Organization
User --> OrganizationAdmin
User --> Donation
User --> Bookmark
User --> Review
User --> VolunteerApplication
User --> Notification
User --> AuditLog
User --> PasswordResetToken
User --> EmailVerificationToken

Organization --> OrganizationAdmin
Organization --> OrganizationDocument
Organization --> OrganizationCategory
Category --> OrganizationCategory

Organization --> Donation
Organization --> Bookmark
Organization --> Review

Organization --> Event
Event --> VolunteerApplication
VolunteerApplication --> Certificate

Organization --> Announcement
Organization --> FinancialReport
```

## Main Modules (Vertical)

``` mermaid
flowchart TD

Platform[NGO Connect Platform]

Platform --> Authentication
Platform --> NGOManagement
Platform --> VolunteerManagement
Platform --> Donations
Platform --> Engagement
Platform --> Reports

Authentication --> User
Authentication --> Verification
Authentication --> PasswordReset
Authentication --> EmailVerification

NGOManagement --> Organization
NGOManagement --> Admins
NGOManagement --> Documents
NGOManagement --> Categories

VolunteerManagement --> Events
VolunteerManagement --> Applications
VolunteerManagement --> Certificates

Donations --> Donation

Engagement --> Reviews
Engagement --> Bookmarks
Engagement --> Notifications
Engagement --> Announcements

Reports --> FinancialReports
Reports --> AuditLogs
```

## Amendments (agreed, apply when writing Drizzle schema)

### 1. Item donations - the core differentiator
Money-only `Donation` misses the "donate stuff" idea. Add:

- **OrganizationNeed** - organization_id, title, item, quantity_needed, quantity_fulfilled, urgency, status, created_at/updated_at. What an NGO is asking for.
- **ItemDonation** - need_id (nullable - spontaneous donations allowed), organization_id, donor_id, item, quantity, status (`pledged | in_transit | received | cancelled`), message, created_at. Item pledges fulfil needs.
- Keep monetary `Donation` in the schema but ship item donations first (payments need gateway + 80G receipt work).

### 2. Auth is Better Auth - drop hand-rolled auth tables
Better Auth owns `user`, `session`, `account`, `verification`. Therefore:

- **Remove**: `PasswordResetToken`, `EmailVerificationToken`, and `password_hash` / `email_verified` on User - Better Auth manages all of these.
- **Extend** Better Auth's `user` via additional fields (or a 1:1 `user_profile`): `role`, `phone`, `profile_photo`, `verification_status`.
- Sessions replace the refresh-token machinery.

### 3. Fields the app already collects (missing from Organization)
`org_type` (legal type: trust/society/section-8 - distinct from category), `team_size`, `founding_year`, `updated_at`, `onboarding_step` (server-side onboarding progress).

### 4. Constraints & types (bake into Drizzle)
- Unique pairs: `Bookmark(user_id, organization_id)`, `Review(user_id, organization_id)`, `OrganizationCategory(organization_id, category_id)`, `VolunteerApplication(event_id, user_id)`; unique `Organization.registration_number`.
- pgEnums for: `role`, `verification_status`, record `status` fields, `document_type`, `notification.type`, `urgency`.
- Every mutable table gets `created_at` + `updated_at`.
- `Event`: add `start_time`/`end_time`, `city`, `latitude`/`longitude`, `cover_image`, `created_at`.
- Store object-storage **keys**, not URLs (presign on read) for all documents/receipts/certificates/images.
- `AuditLog.old_value`/`new_value` → `jsonb`; `Donation.amount` → `numeric` + `currency`.
- `Notification`: add `data jsonb`; new **PushToken** table (user_id, expo_push_token, platform) for delivery.

## Key Relationships

-   User → Organization (1:N)
-   User → Donation (1:N)
-   User → Review (1:N)
-   User → Bookmark (1:N)
-   User → VolunteerApplication (1:N)
-   Organization → Event (1:N)
-   Event → VolunteerApplication (1:N)
-   VolunteerApplication → Certificate (1:1)
-   Organization ↔ Category (M:N via OrganizationCategory)
-   Organization → FinancialReport (1:N)
-   Organization → Announcement (1:N)