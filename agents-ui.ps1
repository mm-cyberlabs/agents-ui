#Requires -Version 5.1
<#
.SYNOPSIS
    agents-ui launcher for Windows
.DESCRIPTION
    Starts the agents-ui TUI dashboard, web dashboard, or manages installation.
.EXAMPLE
    .\agents-ui.ps1
    .\agents-ui.ps1 web
    .\agents-ui.ps1 --port 40110
    .\agents-ui.ps1 uninstall
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ─── Script location ─────────────────────────────────────────────────────────

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$Port = if ($env:AGENTS_UI_PORT) { $env:AGENTS_UI_PORT } else { "40110" }

# ─── Parse arguments ─────────────────────────────────────────────────────────

$Command = "start"
$argList = @($args)
$i = 0

# Check if first arg is a port flag
if ($argList.Count -gt 0) {
    if ($argList[0] -eq "-p" -or $argList[0] -eq "--port") {
        if ($argList.Count -gt 1) {
            $Port = $argList[1]
        }
        if ($argList.Count -gt 2) {
            $Command = $argList[2]
        }
    } else {
        $Command = $argList[0]
        # Parse remaining args for --port
        $i = 1
        while ($i -lt $argList.Count) {
            if ($argList[$i] -eq "-p" -or $argList[$i] -eq "--port") {
                if (($i + 1) -lt $argList.Count) {
                    $Port = $argList[$i + 1]
                    $i += 2
                } else {
                    $i++
                }
            } else {
                $i++
            }
        }
    }
}

# ─── Helpers ─────────────────────────────────────────────────────────────────

function ConvertTo-KebabCase {
    param([string]$Name)
    $result = ""
    for ($j = 0; $j -lt $Name.Length; $j++) {
        $ch = $Name[$j]
        if ([char]::IsUpper($ch) -and $j -gt 0) {
            $result += "-"
        }
        $result += [char]::ToLower($ch)
    }
    return $result
}

function Ensure-Server {
    # Check if server is already running on the target port
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            return
        }
    } catch {
        # Server not running, start it
    }

    Write-Host "  Starting background server on port $Port..." -ForegroundColor DarkGray

    $nodePath = (Get-Command node).Source
    $cliEntry = Join-Path $ScriptDir "packages\cli\dist\index.js"

    # Start server as a hidden background process
    Start-Process -FilePath $nodePath `
        -ArgumentList "`"$cliEntry`" serve --port $Port" `
        -WorkingDirectory $ScriptDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput "NUL" `
        -RedirectStandardError "NUL"

    # Wait up to 5 seconds for the server to be ready
    $ready = $false
    for ($attempt = 1; $attempt -le 50; $attempt++) {
        Start-Sleep -Milliseconds 100
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch {
            # Not ready yet
        }
    }

    if (-not $ready) {
        Write-Host "  [X] Server failed to start" -ForegroundColor Red
        exit 1
    }
}

# ─── Commands ────────────────────────────────────────────────────────────────

function Cmd-Start {
    Write-Host "agents-ui" -ForegroundColor Cyan -NoNewline
    Write-Host " -- starting on port $Port" -ForegroundColor DarkGray

    Ensure-Server

    $cliEntry = Join-Path $ScriptDir "packages\cli\dist\index.js"
    & node $cliEntry start --port $Port
    exit $LASTEXITCODE
}

function Cmd-Web {
    Write-Host "agents-ui" -ForegroundColor Cyan -NoNewline
    Write-Host " -- starting web UI on port $Port" -ForegroundColor DarkGray

    Ensure-Server

    $cliEntry = Join-Path $ScriptDir "packages\cli\dist\index.js"
    & node $cliEntry web --port $Port
    exit $LASTEXITCODE
}

function Cmd-Serve {
    Write-Host "agents-ui" -ForegroundColor Cyan -NoNewline
    Write-Host " -- starting server on port $Port" -ForegroundColor DarkGray

    $cliEntry = Join-Path $ScriptDir "packages\cli\dist\index.js"
    & node $cliEntry serve --port $Port
    exit $LASTEXITCODE
}

function Cmd-Uninstall {
    Write-Host ""
    Write-Host "Uninstalling agents-ui" -ForegroundColor Yellow
    Write-Host ""

    # Step 1: Remove hooks from settings.json
    Write-Host "  " -NoNewline; Write-Host "->" -ForegroundColor Cyan -NoNewline; Write-Host " Removing Claude Code hooks..."

    $claudeDir = Join-Path $env:USERPROFILE ".claude"
    $settingsFile = Join-Path $claudeDir "settings.json"
    $hooksBaseUrl = "http://localhost:$Port"

    if (Test-Path $settingsFile) {
        try {
            $rawJson = Get-Content -Path $settingsFile -Raw -Encoding UTF8
            $settings = $rawJson | ConvertFrom-Json -AsHashtable

            if ($settings.ContainsKey("hooks")) {
                $hooks = $settings["hooks"]
                $keysToRemove = @()

                foreach ($eventKey in @($hooks.Keys)) {
                    $entries = $hooks[$eventKey]
                    if ($entries -isnot [System.Collections.IEnumerable] -or $entries -is [string]) { continue }

                    $filtered = @()
                    foreach ($entry in $entries) {
                        if ($entry -is [System.Collections.IDictionary] -and $entry.ContainsKey("hooks")) {
                            $entry["hooks"] = @($entry["hooks"] | Where-Object {
                                -not ($_ -is [System.Collections.IDictionary] -and $_["type"] -eq "http" -and $_["url"] -is [string] -and $_["url"].StartsWith($hooksBaseUrl))
                            })
                            if ($entry["hooks"].Count -gt 0) {
                                $filtered += $entry
                            }
                        } else {
                            $filtered += $entry
                        }
                    }

                    if ($filtered.Count -gt 0) {
                        $hooks[$eventKey] = $filtered
                    } else {
                        $keysToRemove += $eventKey
                    }
                }

                foreach ($key in $keysToRemove) {
                    $hooks.Remove($key)
                }

                $settings["hooks"] = $hooks
                $settingsJson = $settings | ConvertTo-Json -Depth 10
                [System.IO.File]::WriteAllText($settingsFile, $settingsJson, [System.Text.Encoding]::UTF8)
            }

            Write-Host "  " -NoNewline; Write-Host "[OK]" -ForegroundColor Green -NoNewline; Write-Host " Hooks removed from ~/.claude/settings.json"
        } catch {
            Write-Host "  " -NoNewline; Write-Host "[!]" -ForegroundColor Yellow -NoNewline; Write-Host " Failed to parse settings.json: $_"
        }
    } else {
        Write-Host "    No settings.json found, skipping" -ForegroundColor DarkGray
    }

    # Step 2: Remove from PATH
    Write-Host "  " -NoNewline; Write-Host "->" -ForegroundColor Cyan -NoNewline; Write-Host " Removing from PATH..."

    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($currentPath) {
        $pathParts = $currentPath.Split(';') | Where-Object { $_.Trim().TrimEnd('\') -ne $ScriptDir.TrimEnd('\') }
        $newPath = $pathParts -join ';'
        if ($newPath -ne $currentPath) {
            [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
            Write-Host "  " -NoNewline; Write-Host "[OK]" -ForegroundColor Green -NoNewline; Write-Host " Removed from user PATH"
        } else {
            Write-Host "    Not found in PATH, skipping" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "    Not found in PATH, skipping" -ForegroundColor DarkGray
    }

    # Step 3: Remove agents-ui.bat
    $batFile = Join-Path $ScriptDir "agents-ui.bat"
    if (Test-Path $batFile) {
        Remove-Item $batFile -Force
        Write-Host "  " -NoNewline; Write-Host "[OK]" -ForegroundColor Green -NoNewline; Write-Host " Removed agents-ui.bat"
    }

    # Step 4: Optionally delete the repo
    Write-Host ""
    Write-Host "  " -NoNewline; Write-Host "?" -ForegroundColor Yellow -NoNewline
    Write-Host " Delete the agents-ui directory? ($ScriptDir)"
    $deleteRepo = Read-Host "    [y/N]"
    if ($deleteRepo -match "^[Yy]") {
        Remove-Item -Path $ScriptDir -Recurse -Force
        Write-Host "  " -NoNewline; Write-Host "[OK]" -ForegroundColor Green -NoNewline; Write-Host " Directory deleted"
    } else {
        Write-Host "    Keeping directory" -ForegroundColor DarkGray
    }

    Write-Host ""
    Write-Host "  agents-ui uninstalled." -ForegroundColor Green
    Write-Host ""
}

function Cmd-Help {
    Write-Host ""
    Write-Host "agents-ui" -ForegroundColor Cyan -NoNewline; Write-Host " -- Real-time Claude Code agent monitor"
    Write-Host ""
    Write-Host "  Usage:" -ForegroundColor White
    Write-Host ""
    Write-Host "    agents-ui" -ForegroundColor Cyan -NoNewline; Write-Host "                  Start the TUI dashboard"
    Write-Host "    agents-ui web" -ForegroundColor Cyan -NoNewline; Write-Host "              Start the web dashboard"
    Write-Host "    agents-ui start" -ForegroundColor Cyan -NoNewline; Write-Host "            Same as agents-ui (default)"
    Write-Host "    agents-ui serve" -ForegroundColor Cyan -NoNewline; Write-Host "            Run server only (no TUI)"
    Write-Host "    agents-ui uninstall" -ForegroundColor Cyan -NoNewline; Write-Host "        Remove agents-ui and hooks"
    Write-Host "    agents-ui help" -ForegroundColor Cyan -NoNewline; Write-Host "             Show this help message"
    Write-Host ""
    Write-Host "  Options:" -ForegroundColor White
    Write-Host ""
    Write-Host "    -p, --port <port>" -ForegroundColor Cyan -NoNewline; Write-Host "         Server port (default: 40110)"
    Write-Host ""
    Write-Host "  Environment:" -ForegroundColor White
    Write-Host ""
    Write-Host "    AGENTS_UI_PORT" -ForegroundColor Cyan -NoNewline; Write-Host "             Override default port"
    Write-Host ""
}

# ─── Route command ───────────────────────────────────────────────────────────

switch ($Command) {
    "start"     { Cmd-Start }
    "web"       { Cmd-Web }
    "serve"     { Cmd-Serve }
    "uninstall" { Cmd-Uninstall }
    { $_ -in "help","--help","-h" } { Cmd-Help }
    default {
        Write-Host "Unknown command: $Command" -ForegroundColor Red
        Cmd-Help
        exit 1
    }
}
