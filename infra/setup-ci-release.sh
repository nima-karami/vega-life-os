#!/usr/bin/env bash
# One-time, idempotent setup for .github/workflows/deploy.yml: keyless GitHub -> GCP auth,
# a least-privilege deployer SA, the Cloud Run instance cap, the main-only production
# environment with its secrets, and the repo variables.
# Safe to re-run: every resource is checked before it is created, and bindings are additive.
set -euo pipefail

PROJECT=vega-life-os
PROJECT_NUMBER=433179238763
REGION=us-central1
SERVICE=vega-server
AR_REPO=vega
GITHUB_REPO=nima-karami/vega-life-os
POOL=github
PROVIDER=vega-life-os
DEPLOYER_NAME=vega-deployer
DEPLOYER="$DEPLOYER_NAME@$PROJECT.iam.gserviceaccount.com"
RUNTIME_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.local"

# On Windows, gcloud.cmd goes through cmd.exe, which splits the provider condition at its
# "&&"; calling gcloud.py with the SDK bundled Python passes every argument intact.
if [[ -n "${GCLOUD:-}" ]]; then
  GCLOUD_CMD=("$GCLOUD")
elif [[ -n "${LOCALAPPDATA:-}" ]]; then
  SDK="$LOCALAPPDATA/Google/Cloud SDK/google-cloud-sdk"
  export CLOUDSDK_PYTHON="${CLOUDSDK_PYTHON:-$SDK/platform/bundledpython/python.exe}"
  GCLOUD_CMD=("$CLOUDSDK_PYTHON" "$SDK/lib/gcloud.py")
else
  GCLOUD_CMD=(gcloud)
fi

gc() { "${GCLOUD_CMD[@]}" --quiet "$@"; }
step() { printf '\n== %s\n' "$*"; }

command -v gh >/dev/null || { echo "setup-ci-release: gh is not installed" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "setup-ci-release: run 'gh auth login' first" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "setup-ci-release: $ENV_FILE not found" >&2; exit 1; }

step "APIs"
gc services enable \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  run.googleapis.com artifactregistry.googleapis.com \
  firebasehosting.googleapis.com serviceusage.googleapis.com \
  --project "$PROJECT"

step "Workload Identity pool '$POOL'"
if gc iam workload-identity-pools describe "$POOL" --location global --project "$PROJECT" >/dev/null 2>&1; then
  echo "exists"
else
  gc iam workload-identity-pools create "$POOL" \
    --location global --project "$PROJECT" --display-name "GitHub Actions"
fi

step "OIDC provider '$PROVIDER'"
PROVIDER_FLAGS=(
  --location global --project "$PROJECT" --workload-identity-pool "$POOL"
  --display-name "GitHub vega-life-os main"
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref"
  --attribute-condition "assertion.repository=='$GITHUB_REPO' && assertion.ref=='refs/heads/main'"
)
if gc iam workload-identity-pools providers describe "$PROVIDER" \
  --location global --project "$PROJECT" --workload-identity-pool "$POOL" >/dev/null 2>&1; then
  # Re-assert mapping + condition so a hand-edited provider converges back to this file.
  gc iam workload-identity-pools providers update-oidc "$PROVIDER" "${PROVIDER_FLAGS[@]}" \
    --issuer-uri "https://token.actions.githubusercontent.com"
else
  gc iam workload-identity-pools providers create-oidc "$PROVIDER" "${PROVIDER_FLAGS[@]}" \
    --issuer-uri "https://token.actions.githubusercontent.com"
fi
WIF_PROVIDER="$(gc iam workload-identity-pools providers describe "$PROVIDER" \
  --location global --project "$PROJECT" --workload-identity-pool "$POOL" --format 'value(name)')"

step "Service account '$DEPLOYER'"
if gc iam service-accounts describe "$DEPLOYER" --project "$PROJECT" >/dev/null 2>&1; then
  echo "exists"
else
  gc iam service-accounts create "$DEPLOYER_NAME" \
    --project "$PROJECT" --display-name "VEGA release deployer (GitHub Actions)"
fi

step "Project roles for the deployer"
for ROLE in roles/run.developer roles/firebasehosting.admin roles/serviceusage.serviceUsageConsumer; do
  gc projects add-iam-policy-binding "$PROJECT" \
    --member "serviceAccount:$DEPLOYER" --role "$ROLE" --condition None >/dev/null
  echo "  $ROLE"
done

step "Artifact Registry writer on '$AR_REPO' only"
gc artifacts repositories add-iam-policy-binding "$AR_REPO" \
  --location "$REGION" --project "$PROJECT" \
  --member "serviceAccount:$DEPLOYER" --role roles/artifactregistry.writer >/dev/null
echo "  roles/artifactregistry.writer"

step "actAs on the Cloud Run runtime SA only"
gc iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --project "$PROJECT" \
  --member "serviceAccount:$DEPLOYER" --role roles/iam.serviceAccountUser >/dev/null
echo "  roles/iam.serviceAccountUser on $RUNTIME_SA"

step "Let $GITHUB_REPO impersonate the deployer"
gc iam service-accounts add-iam-policy-binding "$DEPLOYER" --project "$PROJECT" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$GITHUB_REPO" \
  >/dev/null
echo "  roles/iam.workloadIdentityUser"

step "Cloud Run max instances = 2"
MAX_SCALE="$(gc run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" --format json |
  node -e 'let body="";process.stdin.on("data",(chunk)=>{body+=chunk}).on("end",()=>console.log(JSON.parse(body).spec.template.metadata.annotations["autoscaling.knative.dev/maxScale"] ?? ""))')"
if [[ "$MAX_SCALE" == "2" ]]; then
  echo "already 2"
else
  gc run services update "$SERVICE" --max-instances=2 --region "$REGION" --project "$PROJECT"
fi

# I7: deploy credentials live only in an environment that main alone can use.
step "GitHub production environment, limited to main"
gh api -X PUT "repos/$GITHUB_REPO/environments/production" --input - >/dev/null <<'JSON'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
JSON
if gh api "repos/$GITHUB_REPO/environments/production/deployment-branch-policies" \
  --jq '.branch_policies[].name' | grep -qx main; then
  echo "  main branch policy already present"
else
  gh api -X POST "repos/$GITHUB_REPO/environments/production/deployment-branch-policies" \
    -f name=main -f type=branch >/dev/null
  echo "  main branch policy added"
fi

# The project id is public and sits inside every deploy URL; as a secret, GitHub would drop job outputs that contain it.
step "GitHub variable and production environment secrets"
printf '%s' "$PROJECT" | gh variable set GCP_PROJECT --repo "$GITHUB_REPO"
printf '%s' "$WIF_PROVIDER" | gh secret set WIF_PROVIDER --env production --repo "$GITHUB_REPO"
printf '%s' "$DEPLOYER" | gh secret set WIF_SERVICE_ACCOUNT --env production --repo "$GITHUB_REPO"
echo "  GCP_PROJECT (variable), WIF_PROVIDER and WIF_SERVICE_ACCOUNT (production secrets)"

step "GitHub variables from .env.local (names only)"
SET_COUNT=0
while IFS= read -r LINE || [[ -n "$LINE" ]]; do
  LINE="${LINE%$'\r'}"
  [[ "$LINE" =~ ^[[:space:]]*(export[[:space:]]+)?(VITE_[A-Za-z0-9_]+)=(.*)$ ]] || continue
  NAME="${BASH_REMATCH[2]}"
  VALUE="${BASH_REMATCH[3]}"
  VALUE="${VALUE#"${VALUE%%[![:space:]]*}"}"
  VALUE="${VALUE%"${VALUE##*[![:space:]]}"}"
  if [[ "$VALUE" =~ ^\"(.*)\"$ || "$VALUE" =~ ^\'(.*)\'$ ]]; then VALUE="${BASH_REMATCH[1]}"; fi
  [[ -n "$VALUE" ]] || { echo "  skipped $NAME (empty)"; continue; }
  printf '%s' "$VALUE" | gh variable set "$NAME" --repo "$GITHUB_REPO" >/dev/null
  echo "  $NAME"
  SET_COUNT=$((SET_COUNT + 1))
done <"$ENV_FILE"
[[ "$SET_COUNT" -gt 0 ]] || { echo "setup-ci-release: no VITE_* keys found in .env.local" >&2; exit 1; }

step "Done"
echo "Deploys run on every merge to main (.github/workflows/deploy.yml)."
