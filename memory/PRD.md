# KotKlusser - Student Housing Issue Reporting System

## Original Problem Statement
Build a modern, responsive web application for a student housing issue reporting system ("kot meldingssysteem") for students to report defects in their student room (kot) and for landlords to easily manage and resolve those reports.

## User Personas
1. **Student (Tenant)** - Reports defects, tracks status, communicates with landlord
2. **Landlord (Kotbaas)** - Manages reports, updates status, schedules repairs

## Core Requirements
- Issue reporting with categories (Sanitair, Elektriciteit, Verwarming, Internet, Keuken, Anders)
- Unique ticket numbers (KM-YYYYMMDD-XXXXXX format)
- Status tracking: Ontvangen → In Behandeling → Ingepland → In Uitvoering → Opgelost
- Photo attachments
- In-ticket messaging
- Landlord dashboard with filters
- Dutch interface
- Dark purple-blue SaaS theme

## What's Been Implemented (Jan 2026)
### Phase 1 - Core MVP
- [x] JWT Authentication (student & landlord roles)
- [x] Multi-step report wizard (4 steps)
- [x] Ticket CRUD with unique numbers
- [x] Status management & timeline
- [x] In-ticket messaging system
- [x] Photo upload (base64)
- [x] Heuristic repair time estimation
- [x] Landlord dashboard with filters (status, category, urgency)
- [x] Dashboard statistics
- [x] Email notification system (Resend - needs API key)
- [x] Automatic reminder system
- [x] Responsive dark theme UI

### Phase 2 - Property Management
- [x] Property CRUD for landlords
- [x] Property onboarding flow after landlord registration
- [x] Sidebar with properties list + tenant count
- [x] Property detail page with tenants section (name, room, floor)
- [x] Join code system (short code + link)
- [x] Regenerate join code functionality
- [x] Student can join at registration with code
- [x] Student can join via dashboard with code
- [x] Landlord can remove tenants from property
- [x] Tickets linked to properties
- [x] Filter dashboard by property
- [x] Stats filter by selected property

### Phase 3 - Profile Management (Jan 2026)
- [x] Profile page accessible via student name in nav
- [x] Editable fields: voornaam, achternaam, telefoonnummer
- [x] Email address read-only with lock icon
- [x] Email change request flow with landlord approval
- [x] Secure token-based approval links
- [x] Landlord approval/rejection with optional reason
- [x] Email change request history
- [x] Pending request status display
- [x] Cancel pending request functionality
- [x] Room/floor/property info read-only display
- [x] Dutch UI labels throughout

### Phase 3b - Landlord Profile & Floor Configuration (Mar 2026)
- [x] Landlord profile page with editable name, phone, company
- [x] Landlord email change with self-confirmation to new email
- [x] Building floor configuration (floor_count) at property creation
- [x] Auto-generated floor labels (Gelijkvloers, Verdieping 1, 2, etc.)
- [x] Student floor selection dropdown (replaces free-text input)
- [x] Dropdown populated from property's configured floors
- [x] Works in both JoinProperty page and RegisterPage with code

## Tech Stack
- Frontend: React + Tailwind CSS + Shadcn UI + Framer Motion
- Backend: FastAPI + Motor (async MongoDB)
- Database: MongoDB
- Auth: JWT
- Email: Resend (optional)

## Prioritized Backlog
### P0 (Critical) - Done ✓
- All core features implemented including floor configuration

### P1 (High Priority)
- Email notification activation (requires Resend API key from user)
- Push notifications

### P2 (Medium Priority)
- Multi-language support (French, English)
- Maintenance history per room
- Analytics dashboard for landlords

### P3 (Nice to Have)
- Mobile app (React Native)
- Bulk ticket actions
- Export reports to PDF
