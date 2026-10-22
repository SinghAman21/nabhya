# Features by role

What each role can do, and whether it is built. The canonical role definitions
live in `packages/db/src/seed.ts`; the vocabulary (`volunteer` / `organisation` /
`superadmin`) lives in `packages/shared/src/roles.ts`.

The three sections below were converted from the plain-text `PerRoleFeatures.txt`
that used to sit at the repo root.

---

## Volunteer

### Authentication

- [x] Register
- [x] Login
- [x] Logout
- [x] Forgot Password
- [x] Email Verification

### Profile

- [x] Edit Profile
- [x] Upload Verification Document
- [x] View Verification Status

### Organizations

- [x] Browse NGOs
- [x] Search NGOs
- [x] Filter NGOs
- [x] View NGO Details
- [x] Bookmark NGO
- [x] Follow NGO

### Feed

- [x] Browse personalized For You feed
- [x] Browse public Trending feed
- [x] Browse followed-NGO feed
- [x] Like, save, share and comment on feed items

### Donations

- [x] Donate
- [x] View Donation History
- [x] Download Receipt

### Events

- [x] View Events
- [x] Apply for Events
- [x] Track Application Status

### Certificates

- [x] View Certificates
- [x] Download Certificates

### Needs & Pledges

- [x] Post a need or an offer (verified NGOs)
- [x] Review pledges - accept, decline, mark received
- [x] Contact volunteers whose pledge was accepted (issue #9)

### Followers

- [x] Follower count on the NGO page and profile (issue #7)

### Reviews

- [x] Give Rating
- [x] Write Review
- [x] Edit Own Review

### Notifications

- [x] View Notifications (unread count in the sidebar, bell on phones)
- [x] Told when the NGO or a document is verified or rejected, with the reason
- [x] Mark as Read

---

## Superadmin

### Dashboard

- [x] Platform Analytics
- [x] User Statistics
- [x] NGO Statistics
- [x] Donation Statistics

### User Management

- [x] View Users
- [x] Suspend Users
- [x] Delete Users
- [x] Verify Identity Documents

### Organization Management

- [x] View NGOs
- [x] Approve NGOs
- [x] Reject NGOs
- [x] Suspend NGOs
- [x] Delete NGOs

### Document Verification

- [x] Verify NGO Documents
- [x] Verify User Documents

### Categories

- [x] Add Categories
- [x] Edit Categories
- [x] Delete Categories

### Audit Logs

- [x] View All Logs
- [x] Search Logs

### Reports

- [x] View Donations
- [x] View Financial Reports
- [x] Export Reports

### Notifications

- [x] Broadcast Notifications
- [x] Send Platform Announcements

---

## Organisation (NGO)

### Authentication

- [x] Register
- [x] Login
- [x] Logout

### Organization

- [x] Create NGO
- [x] Edit NGO Profile
- [x] Upload Documents
- [x] View Verification Status

### Team (roles, invites & permissions - epic #10)

- [x] Invite a teammate by email, even before they sign up (7-day link)
- [x] Accepting an invite makes the account an organisation account
- [x] One team per account (a volunteer account cannot accept - use another email)
- [x] Resend / revoke pending invites
- [x] Five roles: Owner, Admin, Manager, Member, Viewer
  - **Owner** - everything, including transferring ownership
  - **Admin** - everything except transferring ownership
  - **Manager** - posts, needs, events, applicants, attendance, certificates
  - **Member** - drafts events, marks attendance
  - **Viewer** - read-only, plus donations
- [x] Change a teammate's role and designation, suspend, remove
- [x] Leave the team (owners transfer ownership first)
- [x] Transfer ownership to an active admin (two-step, with a confirm token)
- [x] Opt-in public "Our team" list on the NGO page
- [x] Every rule enforced server-side (tested role x action)

### Events

- [x] Create Event
- [x] Edit Event
- [x] Delete Event
- [x] View Applicants
- [x] Accept Volunteers
- [x] Reject Volunteers
- [x] Contact accepted volunteers (call, WhatsApp, email)
- [x] Mark attendance and record hours served (issue #8)
- [x] Generate Certificates (print the recorded hours)

### Donations

- [x] View Donations
- [x] View Donor Messages
- [ ] Download Reports (planned - no export endpoint yet)

### Announcements

- [x] Create Announcement
- [x] Edit Announcement
- [x] Delete Announcement

### Financial Reports

- [x] Upload Annual Reports
- [x] Manage Transparency Documents

### Reviews

- [x] View Reviews
- [x] Reply to Reviews

### Feed

- [x] Publish organization feed updates
- [x] Appear in For You, Trending and followers' feeds
- [x] Receive likes, saves, shares and comments on public feed items

### Notifications

- [x] View Notifications
