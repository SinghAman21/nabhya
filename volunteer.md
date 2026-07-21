flowchart TD

A[Register Account] --> B[Verify Email]
B --> C[Complete Profile]
C --> D[Upload Identity Document]
D --> E[Wait for Verification]

E -->|Approved| F[Browse NGOs]
E -->|Rejected| D

F --> G[Search & Filter NGOs]
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
