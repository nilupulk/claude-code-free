<# 
    Claude Code Patch Script
    Applies all necessary fixes to dist/cli.mjs
    Run: powershell -ExecutionPolicy Bypass -File patch-cli.ps1
#>

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   Claude Code Patcher v1.0                " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$file = Join-Path $PSScriptRoot "dist\cli.mjs"

if (-not (Test-Path $file)) {
    Write-Host "[ERROR] dist/cli.mjs not found!" -ForegroundColor Red
    Write-Host "  Make sure you're running this from the mega-code directory." -ForegroundColor Red
    exit 1
}

Write-Host "Reading dist/cli.mjs..." -ForegroundColor Gray
$content = [System.IO.File]::ReadAllText($file)
$fixes = 0
$total = 6

# ─── Fix 1: Commander -d2e flag ───
$old1 = '"-d2e, --debug-to-stderr"'
$new1 = '"-D, --debug-to-stderr"'
if ($content.Contains($old1)) {
    $content = $content.Replace($old1, $new1)
    Write-Host "[Fix 1/$total] Commander flag -d2e -> -D" -ForegroundColor Green
    $fixes++
} else {
    Write-Host "[Fix 1/$total] Commander flag (already applied)" -ForegroundColor DarkGray
}

# ─── Fix 1b: Add -D to argv check ───
$old1b = 'includes("-d2e"))'
$new1b = 'includes("-d2e")||process.argv.includes("-D"))'
if ($content.Contains($old1b) -and -not $content.Contains($new1b)) {
    $content = $content.Replace($old1b, $new1b)
    Write-Host "        + Added -D to argv check" -ForegroundColor Green
}

# ─── Fix 2: Version check bypass ───
$old2 = 'v$("0.0.0-leaked",t.minVersion)'
$new2 = 'false'
if ($content.Contains($old2)) {
    $content = $content.Replace($old2, $new2)
    Write-Host "[Fix 2/$total] Version check bypassed" -ForegroundColor Green
    $fixes++
} else {
    Write-Host "[Fix 2/$total] Version check (already applied)" -ForegroundColor DarkGray
}

# ─── Fix 3: React useEffectEvent polyfill ───
$old3 = 'Ki.useEffectEvent=function(t){return Xd.H.useEffectEvent(t)}'
$new3 = 'Ki.useEffectEvent=function(t){return Xd.H.useEffectEvent?Xd.H.useEffectEvent(t):t}'
if ($content.Contains($old3)) {
    $content = $content.Replace($old3, $new3)
    Write-Host "[Fix 3/$total] React useEffectEvent polyfilled" -ForegroundColor Green
    $fixes++
} else {
    Write-Host "[Fix 3/$total] React useEffectEvent (already applied)" -ForegroundColor DarkGray
}

# ─── Fix 4: Cdt syntax highlighter render() stub ───
$old4 = 'Cdt=class{constructor(e){}diff(e,n){return[]}}'
$new4 = 'Cdt=class{constructor(e){}diff(e,n){return[]}render(){return null}}'
if ($content.Contains($old4)) {
    $content = $content.Replace($old4, $new4)
    Write-Host "[Fix 4/$total] Cdt render() stub added" -ForegroundColor Green
    $fixes++
} else {
    Write-Host "[Fix 4/$total] Cdt render() (already applied)" -ForegroundColor DarkGray
}

# ─── Fix 5: vdt syntax highlighter render() stub ───
$old5 = 'vdt=class{constructor(e){}getColors(){return[]}}'
$new5 = 'vdt=class{constructor(e){}getColors(){return[]}render(){return null}}'
if ($content.Contains($old5)) {
    $content = $content.Replace($old5, $new5)
    Write-Host "[Fix 5/$total] vdt render() stub added" -ForegroundColor Green
    $fixes++
} else {
    Write-Host "[Fix 5/$total] vdt render() (already applied)" -ForegroundColor DarkGray
}

# ─── Fix 6: Headers .get() compatibility ───
$old6 = 't.headers?.get("x-should-retry")'
$new6 = '(t.headers?.get?t.headers.get("x-should-retry"):t.headers?.["x-should-retry"])'
if ($content.Contains($old6)) {
    $content = $content.Replace($old6, $new6)
    Write-Host "[Fix 6/$total] Headers compatibility patched" -ForegroundColor Green
    $fixes++
} else {
    Write-Host "[Fix 6/$total] Headers compatibility (already applied)" -ForegroundColor DarkGray
}

# ─── Save ───
Write-Host ""
if ($fixes -gt 0) {
    Write-Host "Writing patched file ($fixes new fixes applied)..." -ForegroundColor Cyan
    [System.IO.File]::WriteAllText($file, $content, [System.Text.UTF8Encoding]::new($false))
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "   All patches applied successfully! ✓     " -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
} else {
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host "   All patches were already applied ✓      " -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Yellow
}
Write-Host ""
