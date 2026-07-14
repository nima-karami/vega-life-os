# Cloud Scheduler — 5-minute reconcile

The server holds the Google Calendar sync engine. A Cloud Scheduler job pings the
OIDC-guarded `POST /tasks/reconcile` endpoint every 5 minutes; the handler runs both
sync lanes for every connected user and renews near-expiry watch channels.

`needs-human-smoke` — the commands below require the user's GCP project and a deployed
Cloud Run service URL. Author-only in this run; do not apply live.

## Prerequisites

- The backend is deployed (see `gcp-setup.md`) and you have its URL, e.g.
  `https://vega-server-xxxx-uc.a.run.app`.
- A service account the job runs as, e.g. `vega-scheduler@$PROJECT.iam.gserviceaccount.com`.
  It needs `roles/run.invoker` on the service only if the service is deployed
  `--no-allow-unauthenticated`. The current deploy uses `--allow-unauthenticated` and the
  app verifies the OIDC token itself, so `run.invoker` is not strictly required — but the
  OIDC token's **audience must equal the reconcile URL**, which the app checks.

## Create the job

```bash
PROJECT=your-gcp-project
REGION=us-central1
SERVICE_URL=https://vega-server-xxxx-uc.a.run.app   # from `gcloud run services describe`
SCHED_SA=vega-scheduler@$PROJECT.iam.gserviceaccount.com

gcloud scheduler jobs create http vega-reconcile \
  --project "$PROJECT" \
  --location "$REGION" \
  --schedule "*/5 * * * *" \
  --uri "$SERVICE_URL/tasks/reconcile" \
  --http-method POST \
  --oidc-service-account-email "$SCHED_SA" \
  --oidc-token-audience "$SERVICE_URL/tasks/reconcile" \
  --attempt-deadline 300s \
  --time-zone Etc/UTC
```

The `--oidc-token-audience` MUST be `$SERVICE_URL/tasks/reconcile` — the server's
`createOidcVerifier` verifies the token against exactly that audience
(`PUBLIC_BASE_URL + /tasks/reconcile`). A mismatch makes the endpoint return 401.

Set `PUBLIC_BASE_URL=$SERVICE_URL` on the Cloud Run service (the deploy workflow wires
it from the `PUBLIC_BASE_URL` environment variable) so the audience the app expects
matches the one the scheduler sends.

## Update / inspect / delete

```bash
gcloud scheduler jobs update http vega-reconcile --location "$REGION" --schedule "*/5 * * * *"
gcloud scheduler jobs run    vega-reconcile --location "$REGION"   # fire once, on demand
gcloud scheduler jobs delete vega-reconcile --location "$REGION"
```
