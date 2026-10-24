# Volunteer flow

The path a volunteer takes from signup to collecting a certificate. Mirrors the
"volunteer" role described in `AGENTS.md` → Roles.

```mermaid
flowchart TD
    A[Register Account] --> B[Verify Email]
    B --> C[Complete Profile]
    C --> D[Upload Identity Document]
    D --> E[Wait for Verification]
    E -->|Rejected| D
    C --> F[Browse NGOs]
    F --> G[Search & Filter NGOs]
    F --> V[Browse For You / Trending feeds]
    V --> W[Like, save, share or comment]
    V --> X[Follow NGO]
    X --> Y[View Following feed]
    F --> H[View NGO Details]
    H --> I[Bookmark NGO]
    H --> J[Donate]
    H --> K[View Events]
    H --> L[Read Reviews]
    K --> M[Apply for Volunteer Event]
    M --> N[Application Pending]
    N -->|Accepted| O[Attend Event]
    N -->|Rejected| K
    O --> P[Receive Certificate]
    F --> Q[Write Review]
    P --> R[View Certificates]
    A --> S[Forgot Password]
    S --> T[Reset Password]
    F --> U[Receive Notifications]
```

Identity review controls the volunteer's verification status and badge, and it
gates the two in-person acts: **applying to an event and pledging to a need
both require a verified identity** (government ID and selfie, both approved).
Browsing NGOs, the public feed, following, reviewing and donating stay open
while review is pending; the apply and pledge sheets say what is missing and
link to verification.
