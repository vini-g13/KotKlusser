# KotMelding - Student Housing Issue Reporting System

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

## Tech Stack
- Frontend: React + Tailwind CSS + Shadcn UI + Framer Motion
- Backend: FastAPI + Motor (async MongoDB)
- Database: MongoDB
- Auth: JWT
- Email: Resend (optional)

## Prioritized Backlog
### P0 (Critical) - Done ✓
- All core features implemented

### P1 (High Priority)
- Push notifications
- Email notification activation (requires Resend API key)
- Profile/settings page

### P2 (Medium Priority)
- Multi-language support (French, English)
- Maintenance history per room
- Analytics dashboard for landlords

### P3 (Nice to Have)
- Mobile app (React Native)
- Bulk ticket actions
- Export reports to PDF
