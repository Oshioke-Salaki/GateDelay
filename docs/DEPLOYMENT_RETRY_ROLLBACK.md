# Deployment Retry and Rollback

Deployments are gated by backend tests, backend build and health smoke checks, frontend lint/typecheck/build, and the Foundry verification workflow. The production job currently invokes `Backend/scripts/deploy.js` in dry-run mode; a real deployment must use the same preflight gates.

## Retry

1. Inspect the failed deployment log and identify whether the failure is dependency installation, image build/push, Kubernetes rollout, or application health.
2. Retry the same immutable commit/version after the transient cause is resolved:

```bash
cd Backend
node scripts/deploy.js production <git-sha>
```

3. Do not retry repeatedly when the failure is a failed migration, invalid configuration, security finding, or failed health check. Fix the cause and deploy a new commit or explicitly approved release version.
4. Keep the deployment version immutable so a retry cannot silently change the image contents.

## Rollback

`deploy.js` calls `kubectl rollout undo` when a non-dry-run rollout fails, then waits for the rollback rollout to complete. Verify the resulting deployment and health endpoints before closing the incident:

```bash
kubectl rollout status deployment/gatedelay-backend --namespace=prod --timeout=120s
curl --fail https://<host>/api/health
```

If automatic rollback fails, stop further rollout changes, record the failed and last-known-good versions, and run the platform-approved rollback procedure. A rollback is not complete until the health probe, logs, and key application smoke checks pass.

## Operational notes

- Dry runs do not exercise Docker or Kubernetes and must not be reported as production deployment verification.
- Preserve deployment logs and the exact Git SHA for auditability.
- Configure `MARKET_AUDIT_ADMIN_IDS` as a protected comma-separated list before exposing the audit routes.
- Roll back the application image before attempting unrelated infrastructure changes.
