# GateDelay Operational Runbooks

These runbooks cover release failures and emergency controls for the backend.
Use the incident channel and keep every command output with the incident record.

## Failed Deploy

### Trigger

- CI deployment job fails.
- New pods do not become ready.
- `GET /api/health` returns `DOWN` after a release.
- Error rate, latency, or dependency alarms fire during the release window.

### Immediate Checks

```bash
gh run list --workflow deploy --limit 5
kubectl -n <namespace> rollout status deploy/gatedelay-backend
kubectl -n <namespace> get pods -l app=gatedelay-backend
kubectl -n <namespace> logs deploy/gatedelay-backend --tail=200
curl -fsS https://<backend-host>/api/health/details
```

Confirm the deployed image tag matches the intended git SHA:

```bash
kubectl -n <namespace> get deploy gatedelay-backend -o jsonpath='{.spec.template.spec.containers[0].image}'
```

### Operator Steps

1. Stop additional promotion for the same SHA.
2. Capture CI logs, pod events, health response, and image tag.
3. If the rollout is still progressing but health is `UP`, continue watching for one readiness window.
4. If health is `DOWN`, readiness fails, or the deployment exceeds the rollout deadline, roll back.
5. Run the smoke checks before reopening traffic:

```bash
npm run test:api-protection
npm run test:heartbeat
curl -fsS https://<backend-host>/api/health
```

### Escalation

- Page the backend on-call when production readiness fails.
- Page infrastructure on-call when cluster, registry, ingress, DNS, or certificate checks fail.
- Page security on-call if the deploy contains auth, webhook, ABI, signer, or private-key changes.

## Rollback

### Trigger

- A production release causes user-facing errors or degraded dependency checks.
- Contract-facing services fail ABI or deployed-address validation.
- On-chain execution, rollback, or pause operations emit unexpected failures.

### Immediate Checks

```bash
kubectl -n <namespace> rollout history deploy/gatedelay-backend
kubectl -n <namespace> describe deploy gatedelay-backend
curl -fsS https://<backend-host>/api/health/details
```

If the legacy rollback route is involved, inspect rollback history before action:

```bash
curl -fsS https://<backend-host>/rollback/status/<rollback-id>
```

### Operator Steps

1. Announce rollback intent in the incident channel with the affected version and target version.
2. Roll back the Kubernetes deployment:

```bash
kubectl -n <namespace> rollout undo deploy/gatedelay-backend
kubectl -n <namespace> rollout status deploy/gatedelay-backend
```

3. Confirm health and dependency state:

```bash
curl -fsS https://<backend-host>/api/health
curl -fsS https://<backend-host>/api/health/details
```

4. Verify no incompatible migration or deployment registry value remains applied.
5. Record the previous image, restored image, operator, incident link, and validation output.

### Escalation

- Escalate to database owner before reverting migrations or restoring snapshots.
- Escalate to contract owner before changing `DEPLOYMENT_REGISTRY_JSON`, contract addresses, or ABI version expectations.
- Escalate to release manager when rollback does not restore `UP` health within one readiness window.

## Circuit Breaker Activation

### Trigger

- External bridge, oracle, provider, or chain dependency is unsafe or unavailable.
- Suspicious traffic or abuse threatens market integrity.
- Contract-facing flows are producing bad transactions or stale state.

### Immediate Checks

```bash
curl -fsS https://<backend-host>/api/health/details
curl -fsS https://<backend-host>/circuit-breaker/status
kubectl -n <namespace> logs deploy/gatedelay-backend --tail=200
```

Check dependency dashboards for RPC, Redis, MongoDB, provider APIs, and bridge status.

### Operator Steps

1. Identify the smallest affected surface: bridge, oracle, market creation, settlement, or all contract-facing writes.
2. Activate the circuit breaker through the approved route or admin console:

```bash
curl -X POST https://<backend-host>/circuit-breaker/activate \
  -H 'content-type: application/json' \
  -d '{"scope":"<scope>","reason":"<incident-id>: <reason>","actor":"<operator>"}'
```

3. Verify the breaker state:

```bash
curl -fsS https://<backend-host>/circuit-breaker/status
```

4. Confirm affected endpoints return a controlled unavailable response and unaffected read paths remain healthy.
5. Keep the breaker active until the dependency owner confirms recovery and smoke checks pass.
6. Deactivate only after incident lead approval:

```bash
curl -X POST https://<backend-host>/circuit-breaker/deactivate \
  -H 'content-type: application/json' \
  -d '{"scope":"<scope>","reason":"<incident-id>: recovery verified","actor":"<operator>"}'
```

### Escalation

- Page contract owner for transaction, ABI, deployed-address, or signer faults.
- Page provider owner for RPC, oracle, bridge, AI, or flight-data provider faults.
- Page security on-call when activation is due to abuse, leaked credentials, replay attempts, or invalid webhook signatures.
