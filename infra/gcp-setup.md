# GCP one-time setup for the backend deploy

`needs-human-smoke` — every command here touches the user's GCP project and org and is
**not** run in the autonomous build. It documents exactly what the `deploy-server.yml`
workflow and `cloud-scheduler.md` job need so the human can provision it in one pass.

The deploy uses **Workload Identity Federation** (keyless): GitHub Actions mints a short
OIDC token that GCP trades for a service-account credential — no long-lived JSON key is
ever stored in the repo.

```bash
PROJECT=your-gcp-project
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format 'value(projectNumber)')
REGION=us-central1
REPO=your-github-org/vega-life-os          # owner/name of this repo
```

## 1. Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com \
  firestore.googleapis.com \
  --project "$PROJECT"
```

## 2. Artifact Registry (holds the server image)

```bash
gcloud artifacts repositories create vega \
  --project "$PROJECT" --location "$REGION" --repository-format docker
```

## 3. Deploy service account (what Cloud Run runs as / WIF impersonates)

```bash
gcloud iam service-accounts create vega-deployer \
  --project "$PROJECT" --display-name "Vega backend deployer"
DEPLOYER=vega-deployer@$PROJECT.iam.gserviceaccount.com

for ROLE in roles/run.admin roles/artifactregistry.writer \
            roles/iam.serviceAccountUser roles/secretmanager.secretAccessor \
            roles/datastore.user; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member "serviceAccount:$DEPLOYER" --role "$ROLE"
done
```

## 4. Workload Identity Federation pool + provider (keyless GitHub auth)

```bash
gcloud iam workload-identity-pools create github \
  --project "$PROJECT" --location global --display-name "GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github \
  --project "$PROJECT" --location global \
  --workload-identity-pool github \
  --display-name "GitHub OIDC" \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition "assertion.repository=='$REPO'"

POOL_ID=$(gcloud iam workload-identity-pools describe github \
  --project "$PROJECT" --location global --format 'value(name)')

# Let the GitHub repo impersonate the deployer service account.
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" \
  --project "$PROJECT" --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/$POOL_ID/attribute.repository/$REPO"
```

## 5. Secret Manager entries (OAuth + token encryption key)

The server reads these at runtime via `--set-secrets` in the deploy workflow:

```bash
printf '%s' "$GOOGLE_OAUTH_CLIENT_ID"     | gcloud secrets create gcal-oauth-client-id     --project "$PROJECT" --data-file=-
printf '%s' "$GOOGLE_OAUTH_CLIENT_SECRET" | gcloud secrets create gcal-oauth-client-secret --project "$PROJECT" --data-file=-
# 32-byte AES-256-GCM key, base64/hex per token-store's expectation:
printf '%s' "$GCAL_TOKEN_ENC_KEY"         | gcloud secrets create gcal-token-enc-key       --project "$PROJECT" --data-file=-
```

## 6. Firestore named databases

Production uses `(default)`. Staging uses a named `staging` database (the boot guard
refuses `(default)` under any non-production `NODE_ENV`):

```bash
gcloud firestore databases create --database staging --location "$REGION" --project "$PROJECT"
```

## 7. GitHub repo secrets + environment vars

Add these repo **secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `GCP_PROJECT` | `your-gcp-project` |
| `WIF_PROVIDER` | `projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github` |
| `WIF_SERVICE_ACCOUNT` | `vega-deployer@$PROJECT.iam.gserviceaccount.com` |

And per-environment **variables** (staging / production GitHub Environments):

| Variable | Example |
|---|---|
| `PUBLIC_BASE_URL` | the deployed Cloud Run URL, e.g. `https://vega-server-xxxx-uc.a.run.app` |
| `GOOGLE_OAUTH_REDIRECT_URI` | `$PUBLIC_BASE_URL/trpc/calendar.oauthCallback` (match the OAuth client config) |

`PUBLIC_BASE_URL` is chicken-and-egg on the first deploy: deploy once to learn the URL,
then set the variable and redeploy so the OIDC audience + webhook address resolve.

## 8. Cloud Scheduler

See [`cloud-scheduler.md`](cloud-scheduler.md) for the 5-minute reconcile job.
