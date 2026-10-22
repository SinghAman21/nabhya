================================================================================
NGO CONNECT PLATFORM
DATABASE SCHEMA DOCUMENTATION
Project Name : NGO Connect Platform
Version : 1.0
Database : PostgreSQL (Recommended)
Architecture : Relational Database
Total Tables : 19

OVERVIEW
The NGO Connect Platform is a web and mobile application designed exclusively
for NGOs in India. The platform connects NGOs, volunteers, donors, and the
general public through a secure and verified ecosystem.

The database supports:

• User Authentication
• User & NGO Verification
• Organization Management
• Volunteer Management
• Event Management
• Donation Tracking
• Reviews & Bookmarks
• Notifications
• Financial Reports
• Audit Logs
• Password & Email Verification

===============================================================================
TABLE DESCRIPTIONS
USER
Purpose:
Stores every registered user in the system.

Fields:

user_id (Primary Key)
full_name
email (Unique)
password_hash
phone
profile_photo
role
email_verified
verification_status
status
created_at
updated_at
Relationships:

One User can own multiple Organizations.
One User can upload multiple Verification Documents.
One User can make multiple Donations.
One User can bookmark multiple Organizations.
One User can review multiple Organizations.
One User can apply for multiple Events.
One User can receive multiple Notifications.
One User can generate multiple Password Reset Tokens.
One User can generate multiple Email Verification Tokens.
One User can perform multiple Audit Log actions.
USER VERIFICATION DOCUMENT
Purpose:
Stores verification documents uploaded by users.

Fields:

document_id (PK)
user_id (FK)
document_type
document_url
verification_status
verified_by
remarks
uploaded_at
Relationship:

One User → Many Verification Documents

ORGANIZATION
Purpose:
Stores NGO details.

Fields:

organization_id (PK)
owner_user_id (FK)
organization_name
registration_number
email
phone
description
mission
vision
website
logo
cover_image
address
city
state
pincode
latitude
longitude
verification_status
status
created_at
Relationship:

One User can own multiple Organizations.
One Organization can have multiple Admins.
One Organization can have multiple Documents.
One Organization can belong to multiple Categories.
One Organization can receive multiple Donations.
One Organization can have multiple Reviews.
One Organization can have multiple Events.
One Organization can publish multiple Announcements.
One Organization can upload multiple Financial Reports.
ORGANIZATION ADMIN
Purpose:
Stores NGO administrators.

Fields:

id (PK)
organization_id (FK)
user_id (FK)
designation
joined_at
Relationship:

One Organization → Many Admins
One User → Can Admin Multiple Organizations
ORGANIZATION DOCUMENT
Purpose:
Stores legal documents submitted by NGOs.

Examples:

Registration Certificate
PAN
12A Certificate
80G Certificate
FCRA Certificate
Fields:

document_id
organization_id
document_type
document_url
verification_status
verified_by
remarks
Relationship:

One Organization → Many Documents

CATEGORY
Purpose:
Stores NGO categories.

Examples:

Education
Healthcare
Animal Welfare
Women Empowerment
Environment
Fields:

category_id
name
icon
ORGANIZATION CATEGORY
Purpose:
Bridge table between Organizations and Categories.

Fields:

id
organization_id
category_id
Relationship:

Many Organizations ↔ Many Categories

DONATION
Purpose:
Stores donation transactions.

Fields:

donation_id
organization_id
donor_id
amount
payment_method
payment_gateway
transaction_id
receipt_url
anonymous
message
status
donated_at
Relationship:

One User → Many Donations
One Organization → Many Donations
BOOKMARK
Purpose:
Stores NGOs bookmarked by users.

Fields:

bookmark_id
user_id
organization_id
created_at
Relationship:

Many Users ↔ Many Organizations

REVIEW
Purpose:
Stores NGO ratings and reviews.

Fields:

review_id
user_id
organization_id
rating
comment
created_at
Relationship:

One User → Many Reviews
One Organization → Many Reviews
EVENT
Purpose:
Stores volunteering events.

Fields:

event_id
organization_id
title
description
location
event_date
max_volunteers
status
Relationship:

One Organization → Many Events

VOLUNTEER APPLICATION
Purpose:
Stores volunteer applications.

Fields:

application_id
event_id
user_id
status
applied_at
Relationship:

One Event → Many Applications
One User → Many Applications
CERTIFICATE
Purpose:
Stores volunteer certificates.

Fields:

certificate_id
application_id
certificate_url
issued_at
Relationship:

One Volunteer Application → One Certificate

NOTIFICATION
Purpose:
Stores notifications sent to users.

Examples:

Event Approved
Donation Received
Volunteer Accepted
Verification Completed
Fields:

notification_id
recipient_id
title
body
type
is_read
created_at
Relationship:

One User → Many Notifications

ANNOUNCEMENT
Purpose:
Stores announcements made by NGOs.

Fields:

announcement_id
organization_id
title
description
visibility
created_at
Relationship:

One Organization → Many Announcements

FINANCIAL REPORT
Purpose:
Stores annual financial reports uploaded by NGOs.

Fields:

report_id
organization_id
financial_year
report_url
uploaded_at
Relationship:

One Organization → Many Financial Reports

AUDIT LOG
Purpose:
Tracks important actions performed within the system.

Examples:

User Deleted
NGO Approved
Document Verified
Donation Updated
Fields:

log_id
performed_by
action
entity_name
entity_id
old_value
new_value
ip_address
created_at
Relationship:

One User → Many Audit Logs

PASSWORD RESET TOKEN
Purpose:
Stores password reset requests.

Fields:

token
user_id
expires_at
used
Relationship:

One User → Many Password Reset Tokens

EMAIL VERIFICATION TOKEN
Purpose:
Stores email verification tokens.

Fields:

token
user_id
expires_at
Relationship:

One User → Many Email Verification Tokens

===============================================================================
RELATIONSHIP SUMMARY
User → UserVerificationDocument (1 : N)
User → Organization (1 : N)
Organization → OrganizationAdmin (1 : N)
User → OrganizationAdmin (1 : N)
Organization → OrganizationDocument (1 : N)
Organization → OrganizationCategory (1 : N)
Category → OrganizationCategory (1 : N)
User → Donation (1 : N)
Organization → Donation (1 : N)
User → Bookmark (1 : N)
Organization → Bookmark (1 : N)
User → Review (1 : N)
Organization → Review (1 : N)
Organization → Event (1 : N)
Event → VolunteerApplication (1 : N)
User → VolunteerApplication (1 : N)
VolunteerApplication → Certificate (1 : 1)
User → Notification (1 : N)
Organization → Announcement (1 : N)
Organization → FinancialReport (1 : N)
User → AuditLog (1 : N)
User → PasswordResetToken (1 : N)
User → EmailVerificationToken (1 : N)

===============================================================================
DATABASE FEATURES
✓ UUID Primary Keys
✓ Fully Normalized Schema
✓ Secure Authentication
✓ Email Verification
✓ Password Reset Support
✓ NGO Verification Workflow
✓ User Verification Workflow
✓ Multiple Organization Administrators
✓ Donation Tracking
✓ Volunteer Management
✓ Event Registration
✓ Certificate Generation
✓ Notifications
✓ Financial Transparency
✓ Audit Logging
✓ Scalable Architecture
✓ Suitable for React Native + Web Application
