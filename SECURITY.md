# Security Policy

KubeXEye is a browser-only Kubernetes dashboard that talks directly to a cluster's API server, and
the bundled proxy (`server/proxyServer.ts`) resolves credentials from your local kubeconfig
(including client-cert and exec/OIDC credential plugins). Because of that, issues affecting
credential handling, the proxy's request forwarding, or anything that could let one cluster
context/tenant reach another are treated as security-sensitive.

## Reporting a vulnerability

**Please do not open a public issue for a suspected vulnerability.**

Report it privately via [GitHub Security Advisories](https://github.com/KubeGeNx/KubeXEye/security/advisories/new)
for this repository. Include:

- A description of the issue and its potential impact.
- Steps to reproduce (a minimal manifest or request is ideal).
- The version/commit you tested against.

We'll acknowledge the report, investigate, and coordinate a fix and disclosure timeline with you.

## Scope

In scope:

- The bundled proxy server (`server/proxyServer.ts`) — auth resolution, request forwarding, the
  `X-Kube-Context` multi-cluster switching mechanism.
- The browser app's handling of credentials (`ConnectionContext`, bearer tokens in
  `localStorage`) and of cluster data that should be redacted (e.g. Secret values — see
  `src/utils/redact.ts`).
- The Security Analyzer and Resource Analyser's manifest analysis/dry-run paths.

Out of scope:

- Vulnerabilities in Kubernetes itself, or in a cluster you don't control.
- Issues that require an attacker to already have direct access to your kubeconfig or an
  authenticated session in your browser.

## Supported versions

This project does not yet have a formal release/LTS process — security fixes are made against the
latest commit on `main`.
