param(
    [string]$Model = "ollama/qwen2.5"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Starting Free Local Claude Code Setup   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check for Ollama
$ollamaCheck = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollamaCheck) {
    Write-Host "[WARNING] Ollama is not installed or not in your PATH." -ForegroundColor Yellow
    Write-Host "You MUST install it from https://ollama.com/download/windows for Claude to work." -ForegroundColor Yellow
    Write-Host "Press any key to continue anyway, or Ctrl+C to abort..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# 2. Start LiteLLM proxy in a separate window using uvicorn (compatible method)
Write-Host "[1/3] Starting LiteLLM proxy for '$Model' on port 4000..." -ForegroundColor Green

# Create a temp Python script for the proxy with model config
$proxyScript = Join-Path $PSScriptRoot "proxy_start.py"
@"
import os
os.environ['LITELLM_MODEL'] = '$Model'

from litellm.proxy.proxy_server import app
import uvicorn

# Configure the model
from litellm.proxy.proxy_server import initialize
from litellm import Router

general_settings = {}
router_params = {
    "model_list": [
        {
            "model_name": "gpt-4",
            "litellm_params": {"model": "$Model"},
        },
        {
            "model_name": "gpt-3.5-turbo",
            "litellm_params": {"model": "$Model"},
        },
        {
            "model_name": "claude-sonnet-4-20250514",
            "litellm_params": {"model": "$Model"},
        },
        {
            "model_name": "claude-3-5-sonnet-20241022",
            "litellm_params": {"model": "$Model"},
        },
        {
            "model_name": "claude-3-7-sonnet-20250219",
            "litellm_params": {"model": "$Model"},
        },
        {
            "model_name": "claude-sonnet-4-6",
            "litellm_params": {"model": "$Model"},
        },
    ]
}

router = Router(**router_params)
initialize(router=router, model=None)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=4000)
"@ | Set-Content -Path $proxyScript -Encoding UTF8

$proxyProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "python `"$proxyScript`"" -WindowStyle Normal -PassThru

Write-Host "[2/3] Waiting 6 seconds for proxy server to initialize..." -ForegroundColor Green
Start-Sleep -Seconds 6

# 3. Configure environment variables for this session
Write-Host "[3/3] Bypassing login and pointing Claude to local proxy..." -ForegroundColor Green
$env:ANTHROPIC_BASE_URL="http://127.0.0.1:4000"
$env:ANTHROPIC_API_KEY="sk-ant-dummy"

# 4. Start Claude Code
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "          Opening Claude Code!            " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$cliPath = Join-Path $PSScriptRoot "dist\cli.mjs"
$bunPath = "$env:USERPROFILE\.bun\bin\bun.exe"

if (-not (Test-Path $cliPath)) {
    Write-Host "[ERROR] dist/cli.mjs not found. Run 'bun run build:prod' first." -ForegroundColor Red
} elseif (Test-Path $bunPath) {
    & $bunPath $cliPath
} else {
    Write-Host "[ERROR] Bun not found at $bunPath. Please install Bun first." -ForegroundColor Red
}

# Cleanup on exit
Write-Host ""
Write-Host "Claude Code exited. Shutting down proxy..." -ForegroundColor Cyan
Stop-Process -Id $proxyProcess.Id -Force -ErrorAction SilentlyContinue
Remove-Item $proxyScript -ErrorAction SilentlyContinue
