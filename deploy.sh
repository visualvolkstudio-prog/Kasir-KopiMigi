#!/bin/bash
set -e

VPS_USER="gilfram"
VPS_HOST="103.89.6.65"
VPS_WEB_DIR="/var/www/kasirmigi"
VPS_API_DIR="~/kasirmigi"

echo "🚀 Memulai deploy ke VPS..."

# 1. Pull perubahan terbaru
echo "📥 Pull dari GitHub..."
git pull

# 2. Build frontend
echo "🔨 Build frontend..."
npm run build

# 3. Upload dist ke VPS
echo "📤 Upload frontend ke VPS..."
rsync -avz --delete dist/ $VPS_USER@$VPS_HOST:$VPS_WEB_DIR/

# 4. Upload file API ke VPS
echo "📤 Upload API ke VPS..."
rsync -avz api/supabase.js server.js $VPS_USER@$VPS_HOST:$VPS_API_DIR/

# 5. Restart API server
echo "🔄 Restart API server..."
ssh $VPS_USER@$VPS_HOST "pm2 restart kasirmigi-api"

echo ""
echo "✅ Deploy selesai! Cek https://kopimigi.my.id"
