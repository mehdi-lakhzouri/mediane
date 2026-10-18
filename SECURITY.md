# Security policy

CabinGuard handles driver health and safety data. We take every report seriously.

## Reporting a vulnerability

**Do not open a public issue.** Report it privately through GitHub:
**Security > Report a vulnerability** on this repository (private vulnerability reporting).

Please include:

- the affected component (backend API, web console, mobile app, infrastructure) and version or commit;
- steps to reproduce, and the impact you observed;
- any proof of concept, kept to the minimum needed to show the issue.

We acknowledge reports within 3 business days and keep you informed until a fix ships. Please give us a reasonable time to fix the issue before any public disclosure; we will credit you unless you prefer otherwise.

## Scope

In scope: the code in this repository and the container images published from it (`ghcr.io/hejerayadi/cabinguard-*`).

Out of scope: denial of service by volume, social engineering, findings that need a compromised device or account, and reports from automated scanners without a demonstrated impact.

## Supported versions

Only the latest commit on `main` and the latest published images receive security fixes.

## Verifying our images

Published images are signed with Sigstore (keyless) and carry SLSA build provenance and an SPDX SBOM:

```bash
cosign verify ghcr.io/hejerayadi/cabinguard-backend@sha256:<digest> \
  --certificate-identity-regexp '^https://github.com/hejerayadi/EMBs-x-VTS-CabinGuard-ADI/' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
gh attestation verify oci://ghcr.io/hejerayadi/cabinguard-backend@sha256:<digest> \
  -R hejerayadi/EMBs-x-VTS-CabinGuard-ADI
```
