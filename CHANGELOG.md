# Changelog

## 0.2.0 (2026-03-13)

### Features
- **Version update banner**: Web UI shows a dismissable banner when the running server is behind the latest commit on GitHub main, prompting users to run `agents-ui setup` to update.
- **1M context window support**: Context window display now correctly shows 1M for Opus 4.6 and Sonnet 4.6 models instead of hardcoded 200K.
- **Health check command**: Added `agents-ui health` for diagnosing server and hook status.
- **Agent name labels**: Agent tree nodes display agent names/descriptions.
- **Session idle fixes**: Improved idle detection and session lifecycle transitions.
- **Background agent status**: Fixed background agents incorrectly showing as error; handle `async_launched` status.
- **Error messages in agent detail**: Agent detail panel now shows error messages when an agent fails.
- **Windows support**: PowerShell scripts, Task Scheduler integration, and cross-platform path handling.

### Bug Fixes
- Fixed background agents showing error status instead of running for `async_launched` agents.
- Fixed stale hook cleanup in config view.

## 0.1.0

Initial release.
- Real-time monitoring dashboard for Claude Code CLI agents.
- JSONL transcript tailing and HTTP hook integration.
- TUI (terminal) and Web dashboard interfaces.
- Agent tree visualization with token usage tracking.
- Multi-project session grouping.
- macOS LaunchAgent for persistent background server.
