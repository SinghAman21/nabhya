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

Identity review controls the volunteer's verification status and badge; it is
not a prerequisite to browse NGOs, use the public feed, or apply to events.
Volunteers can continue those flows while review is pending.
