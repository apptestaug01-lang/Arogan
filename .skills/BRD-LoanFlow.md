# Business Requirements Document (BRD)
## LoanFlow – Borrower & Admin Portal (Phase 1)

**Version:** 2.0  
**Date:** 2026-08-23  
**Status:** Draft (Enhanced)  

---

## 1. Introduction

### 1.1 Project Overview
LoanFlow is a digital platform for managing loan applications, document storage, and role-based workflows. It serves borrowers, credit analysts, credit approvers, and administrators. The platform simplifies the loan lifecycle—from application submission to approval and monitoring.

This BRD covers **authentication and onboarding** (Login & Signup) as the first phase. All enhancements are designed to ensure a production‑ready, secure, and scalable system.

### 1.2 Business Objectives
- Provide a secure and user-friendly authentication experience.
- Enable role-based access control for different user types.
- Support both password and OTP-based login (for enhanced security).
- Allow users to sign up with their role (Borrower, Admin, Credit Analyst, Credit Approver).
- Enforce strong validation and data integrity.
- Set the foundation for a scalable, cloud‑native application with robust monitoring, logging, and compliance.

### 1.3 Scope
**In Scope (Phase 1):**
- User registration (signup) with mandatory fields: full name, email, mobile (Indian number), password, confirm password, and role selection.
- User login via email or mobile number with password.
- User login via OTP sent to email or mobile (Indian number).
- Role-based user creation.
- Input validation and error handling.
- Session management (remember me with configurable expiry).
- Password strength enforcement.
- OTP rate limiting and expiration.
- Basic account lockout after multiple failed attempts.
- Email verification (optional, but recommended for enhanced security).

**Out of Scope (Phase 1):**
- Dashboard, loan management, document upload, consent management.
- Admin panel for user management.
- Multi-factor authentication (beyond OTP).
- Integration with external identity providers (e.g., Google, LinkedIn).
- Password reset flow (deferred to Phase 2 but design should be extensible).

---

## 2. User Personas

| Persona          | Description                                                                 |
|------------------|-----------------------------------------------------------------------------|
| **Borrower**     | An individual or business entity applying for a loan.                      |
| **Credit Analyst**| Reviews loan applications, assesses risk, and prepares recommendations.    |
| **Credit Approver**| Makes final decisions on loan approvals based on analyst reports.          |
| **Admin**        | Manages users, roles, and system settings.                                 |

---

## 3. Functional Requirements

### 3.1 User Signup

| ID  | Requirement                                                                 | Priority |
|-----|-----------------------------------------------------------------------------|----------|
| S-1 | User shall provide **Full Name** (2–50 chars, letters/spaces/hyphens).     | Must     |
| S-2 | User shall provide a valid **Email** address (unique).                     | Must     |
| S-3 | User shall provide a **Mobile Number** with country code (default +91).    | Must     |
| S-4 | **Indian mobile numbers** must have exactly 10 digits and start with 6–9.  | Must     |
| S-5 | User shall create a **Password** (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special). | Must |
| S-6 | User shall **Confirm Password** (must match).                              | Must     |
| S-7 | User shall select one of four **Roles**: Borrower, Admin, Analyst, Approver.| Must     |
| S-8 | All fields are mandatory; form cannot be submitted with empty fields.      | Must     |
| S-9 | On successful signup, the system shall create a user record and send a welcome email/SMS. | Should |
| S-10| Duplicate email or mobile numbers shall be rejected with a clear error.    | Must     |
| S-11| Email verification: Send a verification link to confirm the email address before allowing login (optional but recommended). | Could    |
| S-12| Password hashing using bcrypt with a cost factor of 12.                    | Must     |
| S-13| Store only the mobile number (without country code) and separate country code field for consistency. | Must |

### 3.2 User Login (Password Mode)

| ID  | Requirement                                                                 | Priority |
|-----|-----------------------------------------------------------------------------|----------|
| L-1 | User shall enter either **Email** or **Mobile Number** (Indian format).    | Must     |
| L-2 | User shall enter a valid **Password**.                                     | Must     |
| L-3 | System shall validate credentials and grant access upon success.           | Must     |
| L-4 | On failure, show generic error (e.g., "Invalid credentials") to prevent user enumeration. | Must |
| L-5 | User may check **"Remember me"** to extend session lifetime (e.g., 7 days).| Should   |
| L-6 | Provide **"Forgot password"** link (UI placeholder) – actual flow is future.| Could    |
| L-7 | Implement account lockout after 5 failed attempts within 15 minutes.       | Must     |
| L-8 | After lockout, user can reset password or wait for cooldown (15 min).      | Must     |
| L-9 | Session tokens shall be JWT with expiration (short-lived access token + refresh token). | Must |

### 3.3 User Login (OTP Mode)

| ID  | Requirement                                                                 | Priority |
|-----|-----------------------------------------------------------------------------|----------|
| O-1 | User shall enter **Email** or **Mobile Number** (Indian format).           | Must     |
| O-2 | System shall send a **6-digit OTP** to the provided email or mobile.       | Must     |
| O-3 | OTP is valid for **60 seconds** (configurable, but recommended).           | Must     |
| O-4 | User enters the OTP via six separate input fields (auto-advance).          | Must     |
| O-5 | On successful OTP verification, user is logged in.                         | Must     |
| O-6 | Resend OTP after expiry; rate limiting: max 5 requests per 10 minutes per identifier. | Must |
| O-7 | OTPs shall be hashed (or encrypted) before storing in DB, never plaintext. | Must     |
| O-8 | OTPs shall be single-use; once verified, mark as used.                     | Must     |
| O-9 | If OTP is requested for an identifier that doesn't exist, still send a success message (to prevent user enumeration). | Should |
| O-10| After successful OTP login, a password should not be required (user can later set password via profile). | Should |

### 3.4 Role-Based Access

| ID  | Requirement                                                                 | Priority |
|-----|-----------------------------------------------------------------------------|----------|
| R-1 | User’s role is stored during signup and used for authorization.            | Must     |
| R-2 | After login, the dashboard view shall adapt based on user role.            | Must     |
| R-3 | Only Admins can create/edit other users (future).                          | Must     |
| R-4 | API endpoints shall enforce role-based permissions via middleware.         | Must     |

---

## 4. Non-Functional Requirements

### 4.1 Security

| Requirement                                                                 | Priority |
|-----------------------------------------------------------------------------|----------|
| Passwords hashed with bcrypt (cost 12).                                    | Must     |
| HTTPS enforced for all communication.                                      | Must     |
| JWT tokens signed with HS256 or RS256; refresh token rotation.             | Must     |
| Session cookies secure, HttpOnly, SameSite=Strict.                        | Must     |
| Rate limiting on login, OTP request, and signup endpoints (e.g., 5 req/min). | Must |
| Input sanitization and parameterized queries to prevent SQL injection.     | Must     |
| CORS restricted to allowed origins.                                        | Must     |
| Security headers (CSP, X-Frame-Options, etc.) set.                         | Must     |
| OTP expiry and reuse prevention.                                           | Must     |
| Account lockout mechanism.                                                 | Must     |
| Audit logging of all authentication events (login, logout, OTP requests, signup). | Should |
| Brute-force protection using exponential backoff.                         | Should   |

### 4.2 Performance & Scalability

| Requirement                                                                 | Priority |
|-----------------------------------------------------------------------------|----------|
| Login/OTP generation < 2 sec; OTP delivery < 5 sec.                        | Must     |
| Support up to 10,000 concurrent users.                                     | Must     |
| Database indexing on email, mobile, and user ID fields.                    | Must     |
| Use connection pooling for PostgreSQL.                                     | Must     |
| Cache frequently used data (e.g., user roles) using Redis (optional).      | Should   |
| OTP storage can use Redis with TTL for faster expiration.                  | Should   |
| Horizontal scaling of Node.js instances (stateless).                      | Must     |

### 4.3 Reliability & Availability

| Requirement                                                                 | Priority |
|-----------------------------------------------------------------------------|----------|
| 99.9% uptime for authentication service.                                   | Must     |
| Graceful error handling and fallback for third-party services (SMS/email). | Must     |
| Health checks for all services.                                            | Should   |
| Auto‑scaling based on CPU/memory usage (AWS Auto Scaling).                 | Should   |
| Database backups (daily) and point‑in‑time recovery.                       | Must     |

### 4.4 Monitoring & Logging

| Requirement                                                                 | Priority |
|-----------------------------------------------------------------------------|----------|
| Structured logging (JSON format) with correlation IDs for requests.        | Must     |
| Log all authentication events, errors, and performance metrics.            | Must     |
| Centralized log aggregation (ELK stack or CloudWatch Logs).                | Should   |
| Monitoring dashboards for login success/failure rates, OTP delivery latency, error rates. | Should |
| Alerts for high error rates, suspicious activity (e.g., many failed logins). | Should |
| Sentry integration for frontend error tracking.                            | Should   |

### 4.5 Compliance & Data Privacy

| Requirement                                                                 | Priority |
|-----------------------------------------------------------------------------|----------|
| GDPR compliance: provide data deletion, consent management, and data portability features (future). | Must |
| Indian IT Act compliance: data localization (store data in India).         | Must     |
| User consent for data processing (collected during signup and viewable in consent management). | Must |
| Data retention policy: delete inactive users after 3 years (configurable). | Should   |
| Anonymize or pseudonymize personal data for analytics.                     | Should   |

### 4.6 Usability & Accessibility

| Requirement                                                                 | Priority |
|-----------------------------------------------------------------------------|----------|
| Responsive design works on mobile, tablet, and desktop.                    | Must     |
| Support for screen readers (ARIA labels, semantic HTML).                   | Should   |
| Password show/hide toggle.                                                 | Should   |
| Clear error messages (user-friendly, not exposing sensitive info).         | Must     |
| Keyboard navigation (tab order, enter key for submission).                 | Must     |
| Internationalization (i18n) – at least English and Hindi (future).        | Could    |

---

## 5. Technical Stack (Detailed)

| Layer            | Technology                                     |
|------------------|------------------------------------------------|
| **Frontend**     | React 18+ (hooks, context API, React Router)  |
| **Backend**      | Node.js (Express), TypeScript                 |
| **ORM**          | Prisma                                         |
| **Database**     | PostgreSQL 14+                                 |
| **Object Storage**| AWS S3 (for documents – future)               |
| **Authentication**| JWT (access/refresh tokens)                   |
| **OTP Service**  | Twilio (SMS) / SendGrid or AWS SES (email)   |
| **Caching**      | Redis (for OTP storage, session caching)      |
| **CI/CD**        | GitHub Actions, AWS CodePipeline               |
| **Monitoring**   | AWS CloudWatch, Sentry, Prometheus/Grafana    |
| **Secrets Mgmt** | AWS Secrets Manager or HashiCorp Vault        |
| **API Gateway**  | AWS API Gateway or Express with custom routes |
| **Testing**      | Jest (unit), Supertest (API), Cypress (E2E)   |

---

## 6. Data Models (Prisma Schema – Enhanced)

\`\`\`prisma
model User {
  id             String    @id @default(cuid())
  fullName       String
  email          String    @unique
  mobile         String?   // store without country code
  countryCode    String    @default("+91")
  passwordHash   String?   // nullable for OTP-only users initially
  role           Role      @default(BORROWER)
  emailVerified  Boolean   @default(false)
  isActive       Boolean   @default(true)
  lockedUntil    DateTime? // lockout timestamp
  failedAttempts Int       @default(0)
  lastLoginAt    DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  sessions       Session[]
  otpRequests    OTPRequest[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  refreshToken String @unique
  accessToken String? // store hashed if needed
  expiresAt DateTime
  createdAt DateTime @default(now())
  revoked   Boolean  @default(false)
}

model OTPRequest {
  id          String   @id @default(cuid())
  identifier  String   // email or mobile
  codeHash    String   // hashed OTP
  expiresAt   DateTime
  used        Boolean  @default(false)
  createdAt   DateTime @default(now())
  attemptCount Int     @default(0) // for resend limiting
}

enum Role {
  BORROWER
  ADMIN
  ANALYST
  APPROVER
}

// Audit log
model AuditLog {
  id          String   @id @default(cuid())
  userId      String?
  action      String   // e.g., LOGIN_SUCCESS, LOGIN_FAILURE, OTP_REQUEST, SIGNUP
  details     Json?    // additional metadata
  ipAddress   String?
  userAgent   String?
  timestamp   DateTime @default(now())
}
\`\`\`

---

## 7. User Journeys (Updated)

### 7.1 Signup Journey
1. User visits \`/signup\`.
2. Fills in required fields.
3. Clicks "Create Account".
4. System validates input (including email format, mobile format, password strength).
5. If valid, hashes password, creates user record with role.
6. (Optional) Sends email verification link.
7. Redirects to login page with success message.

### 7.2 Login (Password) Journey
1. User visits \`/login\`.
2. Enters email/mobile and password.
3. System checks if account is locked; if locked, shows remaining time.
4. Validates credentials against stored hash.
5. On success, generates access and refresh tokens; sets cookies; updates lastLoginAt.
6. On failure, increments failedAttempts; if >5, locks account for 15 min.
7. Redirects to dashboard with role-specific view.

### 7.3 Login (OTP) Journey
1. User selects OTP tab.
2. Enters email/mobile.
3. Clicks "Send OTP".
4. System validates identifier existence (but doesn't reveal) and checks rate limit.
5. Generates 6-digit OTP, hashes, stores in DB/Redis with TTL.
6. Sends OTP via SMS/email.
7. User enters OTP in the six fields.
8. System verifies OTP (hash match, not expired, not used).
9. On success, logs user in (creates session), marks OTP as used.
10. On failure, shows error; allows resend after expiry.

---

## 8. API Endpoints (RESTful Design)

### Authentication
- \`POST /api/auth/signup\` – Register new user.
- \`POST /api/auth/login/password\` – Login with password.
- \`POST /api/auth/login/otp/request\` – Request OTP.
- \`POST /api/auth/login/otp/verify\` – Verify OTP and login.
- \`POST /api/auth/logout\` – Logout (revoke refresh token).
- \`POST /api/auth/refresh\` – Refresh access token.
- \`POST /api/auth/verify-email\` – Verify email (if implemented).

All endpoints return structured JSON with \`success\`, \`message\`, and \`data\` fields. Error responses follow a consistent format (RFC 7807).

---

## 9. Security Considerations (Deep Dive)

- **Password Reset**: Deferred to Phase 2, but the user model includes \`resetToken\` and \`resetTokenExpiry\` fields (not shown).
- **OTP Security**: OTPs are generated using a cryptographically secure pseudo-random number generator (CSPRNG). Hashed with bcrypt or SHA-256 with salt.
- **JWT Best Practices**: Short-lived access tokens (15 min) and long-lived refresh tokens (7 days) stored in HTTP‑only cookies. Refresh token rotation on each refresh.
- **CORS**: Restrict to allowed frontend domains.
- **Rate Limiting**: Implement per IP and per user (for authenticated endpoints) using middleware like \`express-rate-limit\`.
- **Data Validation**: Use Joi or Zod for server-side validation.
- **SQL Injection**: Prisma parameterized queries prevent injection.
- **XSS & CSRF**: Use helmet.js; CSRF protection via same‑site cookies or anti‑CSRF tokens.

---

## 10. Monitoring & Alerting Strategy

| Metric                          | Threshold                                  | Action                                    |
|---------------------------------|--------------------------------------------|-------------------------------------------|
| Login failure rate              | > 5% over 5 min                            | Alert on-call engineer                    |
| OTP delivery latency            | > 5 sec for 90th percentile                | Investigate SMS/email provider            |
| API error rate (4xx/5xx)        | > 1%                                       | Alert dev team                            |
| CPU usage on Node.js instances  | > 80% for 5 min                            | Auto‑scale                                |
| Database connection pool usage  | > 80%                                      | Increase pool size or scale DB            |

---

## 11. Testing Strategy

| Level           | Tools                           | Coverage Target |
|-----------------|---------------------------------|-----------------|
| **Unit Tests**  | Jest (backend), React Testing Library (frontend) | > 80% |
| **Integration** | Supertest, Prisma mock          | Core APIs      |
| **E2E**         | Cypress (login, signup flows)   | All user journeys |
| **Security**    | OWASP ZAP, Snyk (dependency scanning) | Critical, High vulnerabilities |
| **Performance** | Artillery or k6 (load testing)  | 10k concurrent users |

---

## 12. Deployment & Environment Strategy

- **Environments**: Development, Staging, Production (all on AWS).
- **Infrastructure**: Dockerized containers, orchestrated via AWS ECS Fargate or Kubernetes (EKS).
- **CI/CD**: GitHub Actions to build, test, and deploy to respective environments.
- **Environment Variables**: Managed via AWS Parameter Store or Secrets Manager.
- **Blue‑Green Deployment** for zero‑downtime updates.

---

## 13. Risks and Mitigation

| Risk                                      | Mitigation                                                                 |
|-------------------------------------------|----------------------------------------------------------------------------|
| SMS/email OTP delivery failures           | Implement retry logic with exponential backoff; fallback to email if SMS fails. |
| Brute-force attacks on login              | Rate limiting + account lockout; CAPTCHA for excessive attempts.           |
| Database downtime                         | Multi‑AZ RDS deployment with automatic failover.                           |
| JWT token theft                           | Short-lived tokens, refresh rotation, token revocation on logout.          |
| Non‑compliant data handling               | Enforce GDPR/IT Act from design; conduct privacy impact assessment.        |

---

## 14. Glossary

| Term           | Definition                                                                 |
|----------------|----------------------------------------------------------------------------|
| OTP            | One-Time Password, a 6‑digit code sent via SMS/email.                     |
| JWT            | JSON Web Token – used for stateless authentication.                       |
| Role-Based Access Control (RBAC) | Authorization based on user role. |
| Prisma         | ORM for Node.js with type-safe database access.                           |
| bcrypt         | Password hashing algorithm.                                               |

---

## 15. Appendices

- [Wireframes/Mockups] – See \`login.html\` and \`signup.html\` (embedded below).
- [API Specification] – To be documented in OpenAPI (Swagger) during development.
- [Data Flow Diagram] – To be created during architecture design.

---

## 16. Approvals

| Role          | Name            | Date       |
|---------------|-----------------|------------|
| Product Owner |                 |            |
| Tech Lead     |                 |            |
| Security Lead |                 |            |
| QA Lead       |                 |            |

---

**End of Document**
