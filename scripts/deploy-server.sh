#!/usr/bin/env bash
# Builds the server image from the committed HEAD (never the working tree), rolls it out to
# Cloud Run with only --image so env/secret bindings carry forward, then proves /health.
# Extra args (e.g. --allow-red-ci) pass through to the release guard; VEGA_VERSION stamps the image.
set -euo pipefail

PROJECT=vega-life-os
REGION=us-central1
SERVICE=vega-server
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "${GCLOUD:-}" && -n "${LOCALAPPDATA:-}" ]]; then
  SDK="$LOCALAPPDATA/Google/Cloud SDK/google-cloud-sdk"
  export CLOUDSDK_PYTHON="${CLOUDSDK_PYTHON:-$SDK/platform/bundledpython/python.exe}"
  GCLOUD="$SDK/bin/gcloud.cmd"
fi
GCLOUD="${GCLOUD:-gcloud}"

cd "$REPO_ROOT"
node scripts/release-guard.mjs "$@"

SHA="$(git rev-parse --short HEAD)"
VERSION="${VEGA_VERSION:-dev}"
IMAGE="us-central1-docker.pkg.dev/$PROJECT/vega/server:$SHA"
SOURCE_TARBALL="$(mktemp -d)/vega-server-$SHA.tar.gz"
trap 'rm -rf "$(dirname "$SOURCE_TARBALL")"' EXIT

git archive --format=tar.gz -o "$SOURCE_TARBALL" HEAD
"$GCLOUD" builds submit "$SOURCE_TARBALL" \
  --config cloudbuild.server.yaml \
  --substitutions "_GIT_SHA=$SHA,_APP_VERSION=$VERSION" \
  --project "$PROJECT"
"$GCLOUD" run deploy "$SERVICE" --image "$IMAGE" --region "$REGION" --project "$PROJECT"

SERVICE_URL="$("$GCLOUD" run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" --format 'value(status.url)')"
LIVE_SHA="$(curl -fsS "$SERVICE_URL/health" | node -e 'let body="";process.stdin.on("data",(chunk)=>{body+=chunk}).on("end",()=>console.log(JSON.parse(body).sha))')"
if [[ "$LIVE_SHA" != "$SHA" ]]; then
  echo "deploy-server: FAILED — /health reports sha $LIVE_SHA, expected $SHA" >&2
  exit 1
fi
VEGA_API_URL="$SERVICE_URL" node scripts/check-live-schema.mjs
echo "deploy-server: OK — $SERVICE serving $SHA ($VERSION)"
