# GCP and GitHub setup for CI releases

`.github/workflows/release.yml` deploys from GitHub Actions with **Workload Identity
Federation**: the job trades its GitHub OIDC token for a short-lived credential of the
`vega-deployer` service account. No JSON key exists anywhere.

All of that is provisioned by one idempotent script, run once by a human with owner rights
on `vega-life-os` and `gh auth login` done:

```bash
bash infra/setup-ci-release.sh
```

It checks before it creates, re-asserts the provider's mapping and condition, and IAM
bindings are additive, so re-running it is safe. On Windows it calls `gcloud.py` through the
SDK's bundled Python, because `gcloud.cmd` routes through `cmd.exe`, which would split the
provider condition at `&&`. Set `GCLOUD` to use another gcloud binary.

## What it creates

| Resource | Value |
|---|---|
| APIs | `iam`, `iamcredentials`, `sts`, `run`, `artifactregistry`, `firebasehosting`, `serviceusage` |
| WIF pool | `projects/433179238763/locations/global/workloadIdentityPools/github` |
| OIDC provider | `vega-life-os`, issuer `https://token.actions.githubusercontent.com` |
| Attribute mapping | `google.subject=assertion.sub, attribute.repository=assertion.repository, attribute.ref=assertion.ref` |
| Attribute condition | `assertion.repository=='nima-karami/vega-life-os' && assertion.ref=='refs/heads/main'` |
| Service account | `vega-deployer@vega-life-os.iam.gserviceaccount.com` |
| Cloud Run | `vega-server --max-instances=2`, applied only if the current revision is not already capped at 2 |

The condition means no token from a fork, another repo, a PR or a non-main branch can
authenticate at all. The workflow's own `refs/heads/main` check is a second line.

## Deployer roles, and why each one

| Role | Scope | Needed for |
|---|---|---|
| `roles/run.developer` | project | `run deploy --no-traffic --tag`, `update-traffic`, `services describe`. Not `run.admin`: the release never changes the service's IAM policy (invoker stays as it is), which is the only thing `admin` adds. |
| `roles/iam.serviceAccountUser` | the runtime SA `433179238763-compute@developer.gserviceaccount.com` only | Cloud Run requires `actAs` on the identity a revision runs as. Bound on that one SA, so the deployer cannot act as any other. |
| `roles/artifactregistry.writer` | the `vega` repository only | `docker push` of `server:<sha>` and reading back its digest. |
| `roles/firebasehosting.admin` | project | `firebase deploy --only hosting` (versions, files, releases), `hosting:clone` for rollback, and the `releases.list` call that records the live version. It also carries `firebase.projects.get`, which firebase-tools reads on start. |
| `roles/serviceusage.serviceUsageConsumer` | project | firebase-tools checks that the Hosting API is enabled (`serviceusage.services.get`), and quota is billed to the project (`serviceusage.services.use`). |
| `roles/iam.workloadIdentityUser` | on `vega-deployer` itself, for `principalSet://…/workloadIdentityPools/github/attribute.repository/nima-karami/vega-life-os` | Lets tokens from the pool impersonate the deployer. |

The deployer has no Secret Manager or Firestore access. A `run deploy` with only `--image`
and `--cpu-boost` keeps the service's env and secret bindings, and the runtime SA, not the deployer, reads
the secrets.

The runtime SA stays the default compute SA on purpose. Swapping it could break the live
signed-in paths, so that change is a separate decision.

## GitHub secrets and variables it sets

| Kind | Name | Value |
|---|---|---|
| variable | `GCP_PROJECT` | `vega-life-os` (public; a secret would mask it out of job outputs) |
| production secret | `WIF_PROVIDER` | the provider's full resource name, read back from gcloud |
| production secret | `WIF_SERVICE_ACCOUNT` | `vega-deployer@vega-life-os.iam.gserviceaccount.com` |
| variable | every `VITE_*` key in the root `.env.local` | the key's value; the script pipes it to `gh variable set` and prints only the name |

`VITE_*` values end up in the public bundle anyway, so they're variables, not secrets. When
`.env.local` changes, re-run the script to sync them.

## Server runtime (already provisioned)

The live service's runtime config predates this script and is unchanged by it: Secret
Manager entries `gcal-oauth-client-id`, `gcal-oauth-client-secret` and `gcal-token-enc-key`
bound with `--set-secrets`, the `vega` Artifact Registry repo, and the reconcile job in
[`cloud-scheduler.md`](cloud-scheduler.md).
