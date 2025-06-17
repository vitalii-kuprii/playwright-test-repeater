# Changelog

All notable changes to the "Playwright Test Repeater" extension will be documented in this file.

## [1.0.0] - 2024-12-17

### 🎉 Initial Release

#### ✨ Features
- **Inline CodeLens buttons** - Run 3x | Run 5x | Run 10x buttons next to every test
- **Multi-language support** - JavaScript, TypeScript, Python, Java, C#
- **Smart config detection** - Automatically finds and respects your `playwright.config.*` files
- **Professional report merging** - Uses native `playwright merge-reports` for perfect HTML reports
- **Environment variable support** - Loads `.env`, `.env.local`, `.env.test` files automatically
- **Sequential execution** - Forces `--workers 1` to prevent parallel interference
- **Progress tracking** - Visual progress bars with cancellation support
- **Intelligent cleanup** - Removes temporary blob reports, keeps only final merged report

#### 🎯 Core Functionality
- **Blob report generation** - Each iteration creates separate blob reports for proper merging
- **Config inheritance** - Uses all your Playwright settings (timeouts, browsers, retries, etc.)
- **Smart output handling** - Places final reports in configured output directory or `playwright-report`
- **Human-readable timing** - Displays durations as `2m 30s` instead of milliseconds
- **Detailed summaries** - Success rates, per-iteration timing, failure details

#### ⚙️ Configuration
- **Extension settings** - Configure default iterations, progress display, failure handling
- **Headed mode toggle** - Override config headless setting via extension
- **Interactive configuration** - Easy setup via Command Palette

#### 🛠️ Technical Details
- **AST-free parsing** - Regex-based test detection for reliability across codebases
- **Error handling** - Graceful fallbacks and informative error messages
- **Resource cleanup** - Automatic cleanup of temporary files and directories
- **Cross-platform** - Works on Windows, macOS, and Linux

### 📊 Supported Test Patterns

#### JavaScript/TypeScript
- `test('name', () => {})` and `it('name', () => {})`
- `test.skip()`, `test.only()`, `it.skip()`, `it.only()`

#### Python
- `def test_*():` and `async def test_*():`
- `pytest` integration with `--headed` and `--browser` flags

#### Java
- `@Test` annotated methods
- Maven and Gradle project support

#### C#
- `[Test]` attributed methods
- MSTest and NUnit support

### 🎨 User Experience
- **One-click execution** - No configuration needed to get started
- **Visual feedback** - Progress bars, status indicators, and detailed output
- **Report integration** - Auto-prompt to open merged HTML reports
- **Error visibility** - Clear error messages and failure summaries