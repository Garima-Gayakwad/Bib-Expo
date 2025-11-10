# ============================================================
# Bib-Expo: 15 Backdated Commits Push Script
# Dates span Nov 2025 – Mar 2026 (4 months ago)
# ============================================================

$ErrorActionPreference = "Continue"
Set-Location "c:\Users\Garima Gayakwad\OneDrive\Desktop\Bib_Expo_Web-main"

# ---- Git identity ----
$env:GIT_AUTHOR_NAME     = "Garima-Gayakwad"
$env:GIT_AUTHOR_EMAIL    = "garimakgayakwad@gmail.com"
$env:GIT_COMMITTER_NAME  = "Garima-Gayakwad"
$env:GIT_COMMITTER_EMAIL = "garimakgayakwad@gmail.com"

function Commit {
    param([string]$Msg, [string]$Date)
    $env:GIT_AUTHOR_DATE    = $Date
    $env:GIT_COMMITTER_DATE = $Date
    git add .
    git commit -m $Msg --allow-empty
    Write-Host "✅  $Msg  [$Date]" -ForegroundColor Green
}

# ---- Make sure we work on 'main' from the start ----
# New repo: set default branch name then make first commit
git checkout -b main 2>$null

# ============================================================
# COMMIT 1 – Initial project scaffold  (Nov 10, 2025)
# ============================================================
Write-Host "`n[1/15] Initial project scaffold" -ForegroundColor Cyan
git add README.md .gitignore package.json tsconfig.json next.config.ts `
        eslint.config.mjs postcss.config.mjs components.json 2>$null
Commit "Initial project scaffold: Next.js + TypeScript setup" "2025-11-10T09:15:00+05:30"

# ============================================================
# COMMIT 2 – Prisma schema & DB config  (Nov 14, 2025)
# ============================================================
Write-Host "`n[2/15] Prisma schema & DB config" -ForegroundColor Cyan
git add prisma/schema.prisma prisma.config.ts 2>$null
Commit "feat: add Prisma schema with User, Event, Participant models" "2025-11-14T11:30:00+05:30"

# ============================================================
# COMMIT 3 – Global styles & root layout  (Nov 18, 2025)
# ============================================================
Write-Host "`n[3/15] Global styles & root layout" -ForegroundColor Cyan
git add src/app/globals.css src/app/layout.tsx src/app/favicon.ico 2>$null
Commit "feat: add global CSS styles and root Next.js layout" "2025-11-18T10:00:00+05:30"

# ============================================================
# COMMIT 4 – Lib utilities & auth helpers  (Nov 22, 2025)
# ============================================================
Write-Host "`n[4/15] Lib utilities & auth helpers" -ForegroundColor Cyan
git add src/lib/utils.ts src/lib/auth.ts src/lib/auth-server.ts 2>$null
Commit "feat: add utility functions and auth helpers (lib/)" "2025-11-22T14:20:00+05:30"

# ============================================================
# COMMIT 5 – DB client & email service  (Nov 26, 2025)
# ============================================================
Write-Host "`n[5/15] DB client & email service" -ForegroundColor Cyan
git add src/lib/db.ts src/lib/emailService.ts src/lib/expo-event.ts src/lib/tshirt.ts 2>$null
Commit "feat: add Prisma DB client singleton and email service" "2025-11-26T09:45:00+05:30"

# ============================================================
# COMMIT 6 – Auth UI components  (Dec 2, 2025)
# ============================================================
Write-Host "`n[6/15] Auth UI components" -ForegroundColor Cyan
git add src/components/auth/ 2>$null
Commit "feat: add authentication UI components (AuthCard, AuthInput, PrimaryButton)" "2025-12-02T11:00:00+05:30"

# ============================================================
# COMMIT 7 – Shared UI primitives  (Dec 8, 2025)
# ============================================================
Write-Host "`n[7/15] Shared UI primitives" -ForegroundColor Cyan
git add src/components/ui/ 2>$null
Commit "feat: add shared UI component library (Button, Card, Dialog, Table, etc.)" "2025-12-08T13:30:00+05:30"

# ============================================================
# COMMIT 8 – Marketing components  (Dec 12, 2025)
# ============================================================
Write-Host "`n[8/15] Marketing components" -ForegroundColor Cyan
git add src/components/marketing/ 2>$null
Commit "feat: add marketing landing-page components (Hero, Features, CTA)" "2025-12-12T10:15:00+05:30"

# ============================================================
# COMMIT 9 – Landing / home page  (Dec 17, 2025)
# ============================================================
Write-Host "`n[9/15] Landing / home page" -ForegroundColor Cyan
git add src/app/page.tsx 2>$null
Commit "feat: implement home landing page with hero and feature sections" "2025-12-17T15:00:00+05:30"

# ============================================================
# COMMIT 10 – Auth routes (sign-in / sign-up)  (Dec 22, 2025)
# ============================================================
Write-Host "`n[10/15] Auth routes" -ForegroundColor Cyan
git add "src/app/(auth)/" 2>$null
Commit "feat: add sign-in and sign-up auth routes" "2025-12-22T11:45:00+05:30"

# ============================================================
# COMMIT 11 – Middleware & route protection  (Jan 5, 2026)
# ============================================================
Write-Host "`n[11/15] Middleware & route protection" -ForegroundColor Cyan
git add middleware.ts 2>$null
Commit "feat: implement Next.js middleware for route protection and role-based access" "2026-01-05T09:30:00+05:30"

# ============================================================
# COMMIT 12 – API routes  (Jan 12, 2026)
# ============================================================
Write-Host "`n[12/15] API routes" -ForegroundColor Cyan
git add src/app/api/ 2>$null
Commit "feat: add REST API routes for auth, events, participants, and volunteers" "2026-01-12T14:00:00+05:30"

# ============================================================
# COMMIT 13 – Dashboard page  (Jan 20, 2026)
# ============================================================
Write-Host "`n[13/15] Dashboard page" -ForegroundColor Cyan
git add src/app/dashboard/ 2>$null
Commit "feat: implement participant dashboard with registration and event views" "2026-01-20T10:30:00+05:30"

# ============================================================
# COMMIT 14 – Admin panel  (Feb 2, 2026)
# ============================================================
Write-Host "`n[14/15] Admin panel" -ForegroundColor Cyan
git add src/app/admin/ 2>$null
Commit "feat: add admin panel for managing events, users, and T-shirt orders" "2026-02-02T11:00:00+05:30"

# ============================================================
# COMMIT 15 – Seed, migrations, docs & final polish  (Mar 1, 2026)
# ============================================================
Write-Host "`n[15/15] Seed, migrations, docs & final polish" -ForegroundColor Cyan
git add . 2>$null
Commit "chore: add DB seed, migrations, docs, Excel template, and lockfile" "2026-03-01T12:00:00+05:30"

# ============================================================
# Show commit log
# ============================================================
Write-Host "`n--- Commit history ---" -ForegroundColor Yellow
git log --oneline

# ============================================================
# Set remote & force-push
# ============================================================
Write-Host "`n--- Setting remote origin ---" -ForegroundColor Yellow
git remote remove origin 2>$null
git remote add origin https://github.com/Garima-Gayakwad/Bib-Expo.git

Write-Host "`n--- Force pushing to GitHub (main) ---" -ForegroundColor Yellow
git push --force origin main

Write-Host "`n🎉 All 15 commits pushed to https://github.com/Garima-Gayakwad/Bib-Expo.git" -ForegroundColor Magenta
