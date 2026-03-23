#!/bin/bash
# TrekTech Labs — Deploy script
# Usage: ./deploy.sh [dev|staging|production]

ENV=${1:-dev}
ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"
PROJECT="bengaluru-trekkers-ops"
REGION="asia-south1"

case $ENV in
  dev)
    HOSTING_TARGET="dev"
    BACKEND_SERVICE="bt-ops-backend-dev"
    BUILD_ENV="development"
    SITE_URL="https://bengaluru-trekkers-dev.web.app"
    ;;
  staging)
    HOSTING_TARGET="staging"
    BACKEND_SERVICE="bt-ops-backend-staging"
    BUILD_ENV="staging"
    SITE_URL="https://bengaluru-trekkers-staging.web.app"
    ;;
  production)
    HOSTING_TARGET="production"
    BACKEND_SERVICE="bt-ops-backend"
    BUILD_ENV="production"
    SITE_URL="https://bengaluru-trekkers-ops.web.app"
    ;;
  *)
    echo "❌ Unknown env: $ENV. Use: dev | staging | production"
    exit 1
    ;;
esac

echo ""
echo "🏔  TrekTech Labs — Deploying to [$ENV]"
echo "    Frontend → $SITE_URL"
echo "    Backend  → $BACKEND_SERVICE"
echo ""

# ── Backend ──────────────────────────────────────────────────────────────────
echo "📦 Deploying backend..."
gcloud run deploy $BACKEND_SERVICE \
  --source "$BACKEND" \
  --region $REGION \
  --project $PROJECT \
  --quiet

if [ $? -ne 0 ]; then echo "❌ Backend deploy failed"; exit 1; fi
echo "✅ Backend deployed"

# ── Frontend ─────────────────────────────────────────────────────────────────
echo ""
echo "🎨 Building frontend for [$BUILD_ENV]..."
cd "$FRONTEND"
REACT_APP_ENV=$BUILD_ENV npm run build

if [ $? -ne 0 ]; then echo "❌ Frontend build failed"; exit 1; fi

echo "🚀 Deploying frontend to [$HOSTING_TARGET]..."
firebase deploy --only hosting:$HOSTING_TARGET --project $PROJECT

if [ $? -ne 0 ]; then echo "❌ Frontend deploy failed"; exit 1; fi

echo ""
echo "✅ Deployed to [$ENV] → $SITE_URL"
echo ""
