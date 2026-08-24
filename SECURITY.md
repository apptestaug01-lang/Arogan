# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

**Do NOT open a public issue.**

Email: security@loanflow.app with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will:
1. Acknowledge your report within 48 hours
2. Verify the vulnerability
3. Provide a fix within 96 hours (Critical) / 7 days (High) / 30 days (Medium/Low)
4. Coordinate public disclosure

## Security Measures in Place

- bcrypt password hashing (cost factor 12)
- JWT access tokens (15 min) with refresh token rotation (7 days)
- OTP codes hashed with SHA-256 before storage
- Account lockout after 5 failed attempts (15 min)
- Rate limiting on all auth endpoints
- Security headers via Helmet.js (CSP, X-Frame-Options, etc.)
- Input sanitization for XSS prevention
- SameSite=Strict, HttpOnly cookies
- CORS restricted to allowed origins
- Audit logging for all auth events
- SQL injection prevention via Prisma parameterized queries

## Responsible Disclosure

We follow responsible disclosure. Please coordinate with us before public disclosure.
