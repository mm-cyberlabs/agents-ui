#Requires -Version 5.1
<#
.SYNOPSIS
    agents-ui installer for Windows
.DESCRIPTION
    Installs dependencies, builds packages, configures Claude Code hooks,
    and creates a launcher command for agents-ui.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ─── Colors / Helpers ────────────────────────────────────────────────────────

function Write-Info    { param([string]$Msg) Write-Host "  " -NoNewline; Write-Host "->" -ForegroundColor Cyan -NoNewline; Write-Host " $Msg" }
function Write-Ok      { param([string]$Msg) Write-Host "  " -NoNewline; Write-Host "[OK]" -ForegroundColor Green -NoNewline; Write-Host " $Msg" }
function Write-Warn    { param([string]$Msg) Write-Host "  " -NoNewline; Write-Host "[!]" -ForegroundColor Yellow -NoNewline; Write-Host " $Msg" }
function Write-Fail    { param([string]$Msg) Write-Host "  " -NoNewline; Write-Host "[X]" -ForegroundColor Red -NoNewline; Write-Host " $Msg"; exit 1 }
function Write-Step    { param([int]$N, [string]$Msg) Write-Host ""; Write-Host "[$N/$TotalSteps] $Msg" -ForegroundColor White }

$TotalSteps = 5
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$Port = if ($env:AGENTS_UI_PORT) { $env:AGENTS_UI_PORT } else { "40110" }

# ─── Banner ──────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "   +=========================================+" -ForegroundColor Cyan
Write-Host "   |         agents-ui  installer            |" -ForegroundColor Cyan
Write-Host "   |   Real-time Claude Code agent monitor   |" -ForegroundColor Cyan
Write-Host "   +=========================================+" -ForegroundColor Cyan
Write-Host ""
Write-Host "  This will install agents-ui and configure" -ForegroundColor DarkGray
Write-Host "  Claude Code hooks for real-time monitoring." -ForegroundColor DarkGray
Write-Host ""

# ─── Step 1: Check prerequisites ─────────────────────────────────────────────

Write-Step 1 "Checking prerequisites"

# Windows check
if ($IsLinux -or $IsMacOS) {
    Write-Warn "Non-Windows system detected. This installer is optimized for Windows."
} else {
    Write-Ok "Windows detected"
}

# Node.js check
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Fail "Node.js is not installed. Install it from https://nodejs.org (v18+) or via: winget install OpenJS.NodeJS / choco install nodejs"
}

$nodeVersionRaw = & node -v
$nodeVersionMajor = [int]($nodeVersionRaw -replace '^v','') -replace '\..*',''
if ($nodeVersionMajor -lt 18) {
    Write-Fail "Node.js v18+ is required (found $nodeVersionRaw). Update via: winget upgrade OpenJS.NodeJS"
}
Write-Ok "Node.js $nodeVersionRaw found"

# pnpm check
$pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmCmd) {
    Write-Warn "pnpm not found. Attempting to install via corepack..."
    $corepackCmd = Get-Command corepack -ErrorAction SilentlyContinue
    if ($corepackCmd) {
        try {
            & corepack enable
            & corepack prepare pnpm@latest --activate
            Write-Ok "pnpm installed via corepack"
        } catch {
            Write-Fail "Failed to install pnpm via corepack. Install manually: npm install -g pnpm"
        }
    } else {
        Write-Fail "pnpm is not installed and corepack is unavailable. Install pnpm: npm install -g pnpm"
    }
} else {
    $pnpmVersion = & pnpm -v
    Write-Ok "pnpm $pnpmVersion found"
}

# Claude Code directory check
$claudeDir = Join-Path $env:USERPROFILE ".claude"
if (Test-Path $claudeDir) {
    Write-Ok "Claude Code directory found (~/.claude)"
} else {
    Write-Warn "~/.claude directory not found. Claude Code may not be installed."
    Write-Warn "agents-ui will still install, but won't find any sessions until Claude Code runs."
}

# ─── Step 2: Install dependencies ────────────────────────────────────────────

Write-Step 2 "Installing dependencies"

Push-Location $ScriptDir
try {
    Write-Info "Running pnpm install..."
    & pnpm install --reporter=default 2>&1 | Select-Object -Last 5 | ForEach-Object { Write-Host "    $_" }
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { Write-Fail "pnpm install failed" }
    Write-Ok "Dependencies installed"
} finally {
    Pop-Location
}

# ─── Step 3: Build all packages ──────────────────────────────────────────────

Write-Step 3 "Building packages"

Push-Location $ScriptDir
try {
    Write-Info "Building core -> server, tui, web -> cli..."
    & pnpm run build 2>&1 | Select-String -Pattern "(Done|built in)" | ForEach-Object { Write-Host "    $_" }
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { Write-Fail "Build failed" }
    Write-Ok "All packages built"
} finally {
    Pop-Location
}

# ─── Step 4: Configure Claude Code hooks ─────────────────────────────────────

Write-Step 4 "Configuring Claude Code hooks"

$settingsFile = Join-Path $claudeDir "settings.json"
$hooksBaseUrl = "http://localhost:$Port"

# Ensure ~/.claude directory exists
if (-not (Test-Path $claudeDir)) {
    New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
}

$hookEvents = @("SessionStart", "SessionEnd", "PreToolUse", "PostToolUse", "SubagentStart", "SubagentStop", "Stop", "PreCompact")

# Convert PascalCase to kebab-case
function ConvertTo-KebabCase {
    param([string]$Name)
    $result = ""
    for ($i = 0; $i -lt $Name.Length; $i++) {
        $ch = $Name[$i]
        if ([char]::IsUpper($ch) -and $i -gt 0) {
            $result += "-"
        }
        $result += [char]::ToLower($ch)
    }
    return $result
}

# Read existing settings or create empty object
$settings = @{}
if (Test-Path $settingsFile) {
    try {
        $rawJson = Get-Content -Path $settingsFile -Raw -Encoding UTF8
        $settings = $rawJson | ConvertFrom-Json -AsHashtable -ErrorAction Stop
    } catch {
        Write-Warn "Existing settings.json is invalid JSON. Backing up and creating new one."
        $backupName = "settings.json.bak.$(Get-Date -Format 'yyyyMMddHHmmss')"
        Copy-Item $settingsFile (Join-Path $claudeDir $backupName)
        $settings = @{}
    }
}

# Ensure hooks key exists
if (-not $settings.ContainsKey("hooks")) {
    $settings["hooks"] = @{}
}

foreach ($event in $hookEvents) {
    $slug = ConvertTo-KebabCase $event
    $hookUrl = "$hooksBaseUrl/api/hooks/$slug"

    # Get existing entries for this event
    $existing = @()
    if ($settings["hooks"].ContainsKey($event)) {
        $raw = $settings["hooks"][$event]
        if ($raw -is [System.Collections.IEnumerable] -and $raw -isnot [string]) {
            $existing = @($raw)
        }
    }

    # Check if already configured
    $alreadyConfigured = $false
    foreach ($entry in $existing) {
        if ($entry -is [System.Collections.IDictionary] -and $entry.ContainsKey("hooks")) {
            foreach ($h in $entry["hooks"]) {
                if ($h -is [System.Collections.IDictionary] -and $h["type"] -eq "http" -and $h["url"] -eq $hookUrl) {
                    $alreadyConfigured = $true
                    break
                }
            }
        }
        if ($alreadyConfigured) { break }
    }

    if (-not $alreadyConfigured) {
        $newEntry = @{
            hooks = @(
                @{
                    type    = "http"
                    url     = $hookUrl
                    timeout = 5
                }
            )
        }
        $existing += $newEntry
        $settings["hooks"][$event] = $existing
    }

    Write-Ok "$event -> $hookUrl"
}

# Write settings back
$settingsJson = $settings | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($settingsFile, $settingsJson, [System.Text.Encoding]::UTF8)

Write-Ok "Hooks configured in ~/.claude/settings.json"

# ─── Step 5: Create launcher ─────────────────────────────────────────────────

Write-Step 5 "Creating agents-ui command"

# Create agents-ui.bat wrapper
$batFile = Join-Path $ScriptDir "agents-ui.bat"
$batContent = @"
@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0agents-ui.ps1" %*
"@
[System.IO.File]::WriteAllText($batFile, $batContent, [System.Text.Encoding]::UTF8)
Write-Ok "Created agents-ui.bat"

# Check if ScriptDir is already in PATH
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
$inPath = $false
if ($currentPath) {
    foreach ($p in $currentPath.Split(';')) {
        if ($p.Trim().TrimEnd('\') -eq $ScriptDir.TrimEnd('\')) {
            $inPath = $true
            break
        }
    }
}

if ($inPath) {
    Write-Ok "Project directory already in PATH"
} else {
    Write-Host ""
    Write-Host "  " -NoNewline; Write-Host "?" -ForegroundColor Yellow -NoNewline
    Write-Host " Add agents-ui to your PATH? This lets you run 'agents-ui' from anywhere."
    $addToPath = Read-Host "    [Y/n]"
    if ($addToPath -eq "" -or $addToPath -match "^[Yy]") {
        $newPath = if ($currentPath) { "$currentPath;$ScriptDir" } else { $ScriptDir }
        [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
        # Also update current session
        $env:PATH = "$env:PATH;$ScriptDir"
        Write-Ok "Added to user PATH (restart your terminal for changes to take effect)"
    } else {
        Write-Info "Skipped. You can run agents-ui from: $ScriptDir"
        Write-Info "Or add it manually: `$env:PATH += `";$ScriptDir`""
    }
}

# ─── Done ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "   +=========================================+" -ForegroundColor Green
Write-Host "   |       Installation complete!            |" -ForegroundColor Green
Write-Host "   +=========================================+" -ForegroundColor Green
Write-Host ""
Write-Host "  Usage:" -ForegroundColor White
Write-Host ""
Write-Host "    agents-ui" -ForegroundColor Cyan -NoNewline; Write-Host "              Start the TUI dashboard"
Write-Host "    agents-ui web" -ForegroundColor Cyan -NoNewline; Write-Host "          Start the web dashboard"
Write-Host "    agents-ui --port 40110" -ForegroundColor Cyan -NoNewline; Write-Host " Use a custom port"
Write-Host "    agents-ui uninstall" -ForegroundColor Cyan -NoNewline; Write-Host "    Remove agents-ui completely"
Write-Host ""
Write-Host "  Open a Claude Code session in another terminal and" -ForegroundColor DarkGray
Write-Host "  watch your agents appear in real-time." -ForegroundColor DarkGray
Write-Host ""
