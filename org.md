flowchart TD

A[Register User Account]
--> B[Create Organization]

B --> C[Upload NGO Documents]

C --> D[Wait for Verification]

D -->|Approved| E[Organization Dashboard]
D -->|Rejected| C

E --> F[Edit Organization Profile]

E --> G[Manage Events]

G --> H[Create Event]
H --> I[Receive Volunteer Applications]

I --> J[Accept Volunteer]
I --> K[Reject Volunteer]

J --> L[Volunteer Attends Event]

L --> M[Generate Certificate]

E --> N[Post Announcement]

E --> O[Upload Financial Reports]

E --> P[View Donations]

P --> Q[Download Reports]

E --> R[Manage Organization Admins]

E --> S[Respond to Reviews]

E --> T[Receive Notifications]