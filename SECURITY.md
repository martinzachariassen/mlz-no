# Security Policy

Thanks for helping keep **mlz.no** and its users safe. This document explains
how to report a security vulnerability and what to expect after you do.

## Supported versions

This repository ships a single, continuously deployed static site. Only the
current `main` branch — the code live at <https://mlz.no> — is supported and
receives security fixes. There are no maintained older releases.

| Version        | Supported          |
| -------------- | ------------------ |
| `main` (live)  | :white_check_mark: |
| anything older | :x:                |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report a vulnerability privately through either channel:

- **GitHub private vulnerability reporting (preferred):**
  <https://github.com/martinzachariassen/mlz-no/security/advisories/new>
- **Email:** [hi@mlz.no](mailto:hi@mlz.no)

To help triage quickly, please include as much of the following as you can:

- a description of the vulnerability and its potential impact,
- step-by-step instructions to reproduce it,
- the affected URL, page, or source file, and
- any proof-of-concept, logs, or screenshots.

## What to expect

I maintain this project solo, so timelines are best-effort but taken seriously:

- **Acknowledgement:** within **48 hours** of your report.
- **Assessment & triage:** an initial severity assessment and a disclosure
  timeline within **7 days**.
- **Resolution:** validated vulnerabilities are typically fixed and deployed
  within **90 days**, with critical issues prioritized ahead of that window.

## Coordinated disclosure

I follow a coordinated disclosure process. Please give me a reasonable
opportunity to remediate the vulnerability before any public disclosure. Once a
fix is deployed, I'm happy to publish a security advisory crediting you for the
report (unless you prefer to remain anonymous).

## Scope

This is a static personal homepage with no user accounts, no backend database,
and no server-side application code — it is served as static assets from
Firebase Hosting. Reports about the site's content security, HTTP response
headers, dependency vulnerabilities, or the CI/CD supply chain are all in scope
and welcome.
