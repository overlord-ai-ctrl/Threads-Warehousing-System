#!/bin/bash

echo "🔍 Threads Ops Self-Check Starting..."
echo "======================================"

# 1. Lint check
echo "📝 Running ESLint..."
if npm run lint; then
    echo "✅ ESLint passed"
else
    echo "❌ ESLint failed"
    exit 1
fi

# 2. TypeScript check
echo "🔧 Running TypeScript check..."
if npm run typecheck; then
    echo "✅ TypeScript check passed"
else
    echo "❌ TypeScript check failed"
    exit 1
fi

# 3. Environment variable check
echo "🌍 Checking environment variables..."
if [ -f .env ]; then
    echo "✅ .env file exists"
    
    # Check for required Vite env vars
    if grep -q "VITE_SUPABASE_URL" .env; then
        echo "✅ VITE_SUPABASE_URL found"
    else
        echo "⚠️  VITE_SUPABASE_URL missing"
    fi
    
    if grep -q "VITE_SUPABASE_ANON_KEY" .env; then
        echo "✅ VITE_SUPABASE_ANON_KEY found"
    else
        echo "⚠️  VITE_SUPABASE_ANON_KEY missing"
    fi
else
    echo "❌ .env file not found"
    exit 1
fi

# 4. Supabase connection test
echo "🔗 Testing Supabase connection..."
if [ -n "$SUPABASE_SERVICE_KEY" ]; then
    echo "✅ SUPABASE_SERVICE_KEY is set"
    # Test connection with service key
    if curl -s -H "apikey: $SUPABASE_SERVICE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" "$SUPABASE_URL/rest/v1/?select=" > /dev/null 2>&1; then
        echo "✅ Supabase connection successful"
    else
        echo "❌ Supabase connection failed"
    fi
else
    echo "⚠️  SUPABASE_SERVICE_KEY not set, skipping connection test"
fi

echo "======================================"
echo "🎉 Self-check completed successfully!"
