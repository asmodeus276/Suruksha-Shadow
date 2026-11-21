# =============================================================
# setup-vercel-env.ps1
# Suraksha Shadow — push all .env secrets to Vercel in one shot
# =============================================================
# HOW TO USE:
#   1. Run:  npx vercel login
#   2. Then: .\setup-vercel-env.ps1
# =============================================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Suraksha Shadow — Vercel Env Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env file not found at $envFile" -ForegroundColor Red
    exit 1
}

# Parse .env file (skip comments and blank lines)
$envVars = @{}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $parts = $line.Split("=", 2)
        $key   = $parts[0].Trim()
        $value = $parts[1].Trim()
        # Remove surrounding quotes if present
        $value = $value.Trim('"').Trim("'")
        if ($key -and $value) {
            $envVars[$key] = $value
        }
    }
}

# Keys to push to Vercel (all environments: production, preview, development)
$keysToSync = @(
    "GEMINI_API_KEY",
    "TEXTBEE_API_KEY",
    "TEXTBEE_DEVICE_ID",
    "SMS_PROVIDER",
    "SMS_DEMO_MODE",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CLIENT_URL",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER"
)

$pushed   = 0
$skipped  = 0
$failed   = 0

foreach ($key in $keysToSync) {
    if (-not $envVars.ContainsKey($key)) {
        Write-Host "  SKIP  $key  (not in .env)" -ForegroundColor Yellow
        $skipped++
        continue
    }

    $value = $envVars[$key]
    Write-Host "  PUSH  $key" -ForegroundColor White -NoNewline

    # Push to all three environments in one call using echo to pipe value
    try {
        $result = $value | npx vercel env add $key production 2>&1
        $result2 = $value | npx vercel env add $key preview   2>&1
        $result3 = $value | npx vercel env add $key development 2>&1
        Write-Host "  ✓" -ForegroundColor Green
        $pushed++
    } catch {
        Write-Host "  ✗ $_" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Done: $pushed pushed, $skipped skipped, $failed failed" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "  1. Go to https://vercel.com/dashboard" -ForegroundColor Yellow
Write-Host "  2. Open your project → Settings → Environment Variables" -ForegroundColor Yellow
Write-Host "  3. Confirm all keys are there" -ForegroundColor Yellow
Write-Host "  4. Trigger a new deployment (or run: npx vercel --prod)" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
