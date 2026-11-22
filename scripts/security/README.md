# Malware merge guard

Run without installing dependencies:

```sh
node --test scripts/security/malware-guard.test.cjs
node scripts/security/malware-guard.cjs
```

The `Malware guard` workflow runs on all pull requests and merge queues, with
read-only repository permissions, no persisted checkout credentials, and no npm
install. It checks Git-tracked files for the indicators in the Drips notice:
known markers, suspicious font and setup paths, editor automatic execution,
package launchers, and suspicious config additions. Findings fail the check.
Resolve each finding through review; do not disable the check to merge it.

## PR commenting bot

`malware-bot.yml` posts a single comment as `github-actions[bot]` when a PR opens
or receives new commits, and updates that comment on subsequent scans. It also
publishes a **Malware bot** commit status on the scanned PR head SHA. A finding
fails the status; incomplete scans produce an error rather than a pass.

The bot runs the scanner from the trusted base commit using `pull_request_target`.
It fetches added/modified files as Git blobs through the API, without checking out
PR code, installing packages, or running PR scripts. It uses the automatic
`GITHUB_TOKEN`; no external service, API key or bot account is needed. Only
contents-read, PR-comment-write and commit-status-write permissions are granted.
The scan caps files at 2 MiB each and 50 MiB total, and fails closed at the
3,000-file API boundary. Removed files are skipped. Dependencies are not audited.

To activate, merge these files into the default branch; open or update a PR
afterwards. The bot cannot review its own initial installation using files that
are not yet in the base branch. Require **Malware bot** as an additional status
check in the branch ruleset once it has reported a result. Keep **Malware guard**
required for full-tree scanning. The commenting bot handles PR heads, not merge
groups: if a merge queue is enabled, use **Malware guard** as the required queue
check rather than requiring **Malware bot** on merge groups. If GitHub Actions policies block
`pull_request_target`, the repository administrator must explicitly permit this
workflow/event. Missing bot runs must never be treated as a passing status.

Run bot tests locally with:

```sh
node --test scripts/security/malware-bot.test.cjs
```

## Required GitHub setup

After this workflow reaches the default branch and has run once, open repository
Settings > Rules > Rulesets. Create or update an active branch ruleset covering
the default branch and any release branches:

- Require a pull request before merging.
- Require status checks to pass: select **Malware guard**, sourced from GitHub
  Actions. Require branches to be up to date (or use a merge queue).
- Require code-owner approval and dismiss stale approvals on new commits.
- Require approval of the most recent reviewable push.
- Block force pushes and deletion. Keep the bypass list empty, including admins
  if the repository plan/settings support this.

CODEOWNERS assigns the workflow, scanner and ownership rules to
`@Oshioke-Salaki`; confirm this account has write access. Changes to these files
need careful review because PRs can otherwise change their own check. A workflow
file alone does not prevent merging: the active required-check rule is essential.
For organization repositories, a centrally enforced required workflow offers
stronger protection against changes to the repository's own workflow.

## Limits

This is a targeted indicator and heuristic scanner, not a malware-free guarantee.
It does not audit dependency contents, submodule contents, or detect every encoded
or novel payload. Config heuristics can flag legitimate changes for review.
Existing build workflows run separately; this check does not prevent those jobs
from executing PR code. Never give untrusted PR jobs secrets or privileged tokens.
