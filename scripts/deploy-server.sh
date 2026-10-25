#!/usr/bin/env bash
# Builds the server image from the committed HEAD (never the working tree), stages it as a no-traffic
# tagged revision (only --image and --cpu-boost, so env/secret bindings carry forward), smokes the tag
# URL, then moves traffic and proves /health. Extra args (--break-glass) pass through to the release
# guard; VEGA_VERSION stamps the image.
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
TAG="c-$SHA"
SOURCE_TARBALL="$(mktemp -d)/vega-server-$SHA.tar.gz"
IS_TAGGED=false
HAS_TRAFFIC_MOVED=false

cleanup() {
  local status=$?
  rm -rf "$(dirname "$SOURCE_TARBALL")"
  if [[ "$IS_TAGGED" == true && "$HAS_TRAFFIC_MOVED" != true ]]; then
    "$GCLOUD" run services update-traffic "$SERVICE" --remove-tags "$TAG" \
      --region "$REGION" --project "$PROJECT" --quiet || echo "deploy-server: could not drop tag $TAG" >&2
    echo "deploy-server: FAILED before traffic moved — live unchanged" >&2
  fi
  exit "$status"
}
trap cleanup EXIT

read_health_sha() {
  curl -fsS --retry 5 --retry-all-errors --retry-delay 3 "$1/health" \
    | node -e 'let body="";process.stdin.on("data",(chunk)=>{body+=chunk}).on("end",()=>console.log(JSON.parse(body).sha))'
}

git archive --format=tar.gz -o "$SOURCE_TARBALL" HEAD
"$GCLOUD" builds submit "$SOURCE_TARBALL" \
  --config cloudbuild.server.yaml \
  --substitutions "_GIT_SHA=$SHA,_APP_VERSION=$VERSION" \
  --project "$PROJECT"
"$GCLOUD" run deploy "$SERVICE" --image "$IMAGE" --no-traffic --tag "$TAG" --cpu-boost \
  --region "$REGION" --project "$PROJECT"
IS_TAGGED=true

TAG_URL="$("$GCLOUD" run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" --format json \
  | node -e 'let body="";process.stdin.on("data",(chunk)=>{body+=chunk}).on("end",()=>{const route=JSON.parse(body).status.traffic.find((entry)=>entry.tag===process.argv[1]);console.log(route?route.url:"")})' "$TAG")"
if [[ -z "$TAG_URL" ]]; then
  echo "deploy-server: FAILED — no URL for tag $TAG" >&2
  exit 1
fi
TAG_SHA="$(read_health_sha "$TAG_URL")"
if [[ "$TAG_SHA" != "$SHA" ]]; then
  echo "deploy-server: FAILED — $TAG_URL/health reports sha $TAG_SHA, expected $SHA" >&2
  exit 1
fi
VEGA_API_URL="$TAG_URL" node scripts/check-live-schema.mjs

"$GCLOUD" run services update-traffic "$SERVICE" --to-latest --region "$REGION" --project "$PROJECT" --quiet
HAS_TRAFFIC_MOVED=true
"$GCLOUD" run services update-traffic "$SERVICE" --remove-tags "$TAG" --region "$REGION" --project "$PROJECT" --quiet

SERVICE_URL="$("$GCLOUD" run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" --format 'value(status.url)')"
LIVE_SHA="$(read_health_sha "$SERVICE_URL")"
if [[ "$LIVE_SHA" != "$SHA" ]]; then
  echo "deploy-server: FAILED — /health reports sha $LIVE_SHA, expected $SHA" >&2
  exit 1
fi
VEGA_API_URL="$SERVICE_URL" node scripts/check-live-schema.mjs
echo "deploy-server: OK — $SERVICE serving $SHA ($VERSION)"
