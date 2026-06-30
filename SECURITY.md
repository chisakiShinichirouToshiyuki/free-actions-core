# Security Policy

## Reporting a vulnerability

Please report security issues privately via GitHub's
**[Private vulnerability reporting](https://github.com/chisakiShinichirouToshiyuki/free-actions-core/security/advisories/new)**
(Security tab → "Report a vulnerability"). Do not open a public issue for
security problems.

We aim to acknowledge reports within a few business days.

## Threat model notes

`free-actions-core` is a translation/adapter library. It holds **no secrets**:
the shared MCP credential and upstream server URL are injected by the caller at
runtime. When deploying it as a public, no-login bridge:

- Keep the shared token in a secret manager — never in source or env committed to git.
- Exclude destructive tools from the public surface via `excludeTools`.
- Put rate limiting / abuse controls in front of the deployed endpoint.

## Automated hardening enabled on this repo

- Dependabot alerts + security updates + grouped version updates
- Secret scanning + push protection
- CodeQL (security-and-quality) on push, PR, and weekly
- Branch protection on `main` (PR required, CI + CodeQL must pass, linear history, no force-push)
