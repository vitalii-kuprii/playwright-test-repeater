# 🎭 Playwright Test Repeater

**Catch flaky tests with ease!** A powerful VSCode extension that repeats Playwright tests multiple times with intelligent report merging.

![VSCode Marketplace](https://img.shields.io/badge/VSCode-Marketplace-blue?style=flat-square&logo=visualstudiocode)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)

## ✨ Features

### 🎯 **Inline Test Buttons**
- **Run 3x | Run 5x | Run 10x** buttons appear next to every test
- Click any button to run that specific test multiple times
- No configuration needed - works out of the box!

### 🔄 **Smart Test Execution**  
- **Respects your Playwright config** - Uses all your settings (timeouts, browsers, etc.)
- **Forces sequential execution** - Prevents parallel interference between runs
- **Environment variable loading** - Automatically loads .env files

### 📊 **Professional Report Merging**
- **Native Playwright reports** - Uses `playwright merge-reports` under the hood
- **All traces included** - Full trace files, screenshots, videos preserved
- **Grouped iterations** - Multiple runs of same test properly displayed
- **One-click access** - Auto-prompts to open merged HTML report

### 🌍 **Multi-Language Support**
Works with all Playwright-supported languages:
- **JavaScript/TypeScript** - `test()`, `it()`, `describe()`
- **Python** - `def test_*()`, `async def test_*()`  
- **Java** - `@Test` annotations
- **C#** - `[Test]` attributes

### ⏱️ **Smart Time Display**
- **Human-readable durations** - `2m 30s` instead of `150000ms`
- **Per-iteration timing** - See which runs were slow
- **Total and average** - Complete performance overview

## 🚀 Quick Start

1. **Install the extension** from VSCode Marketplace
2. **Open any Playwright test file**
3. **See inline buttons** next to each test: `▶️ Run 3x | ▶️ Run 5x | ▶️ Run 10x`
4. **Click to run** - That's it!

## 📖 Usage Examples

### Basic Test Execution
```javascript
// Click "Run 5x" next to this test
test('user login should work', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#username', 'user@example.com');
  await page.fill('#password', 'password');
  await page.click('#login-button');
  await expect(page).toHaveURL('/dashboard');
});
```

### Catching Flaky Tests
Perfect for tests that pass sometimes but fail randomly:
```javascript
test('flaky network request', async ({ page }) => {
  // This might fail 1 out of 10 times due to network issues
  const response = await page.request.get('/api/data');
  expect(response.ok()).toBeTruthy();
});
```

## ⚙️ Configuration

### Extension Settings
- `playwright-test-repeater.defaultIterations`: Default number of iterations (default: 5)
- `playwright-test-repeater.showProgress`: Show progress bar (default: true)  
- `playwright-test-repeater.stopOnFirstFailure`: Stop on first failure (default: false)
- `playwright-test-repeater.runHeaded`: Run in headed mode (default: true)

### Access Settings
- **Command Palette**: `Ctrl+Shift+P` → "⚙️ Configure Test Runs"
- **VSCode Settings**: Search for "Playwright Test Repeater"

## 🎨 What You'll See

### Output Channel
```
=== Iteration 1/5 ===
Executing: npx playwright test --workers 1 --reporter blob --config playwright.config.ts --grep "user login"
Using Playwright config: headless=false
Config timeout: 30000ms
Config expect timeout: 5000ms

=== Merging Playwright Reports ===
Executing: npx playwright merge-reports --reporter html ./blob-report
Output directory: /project/playwright-report
Merged report available at: /project/playwright-report/index.html

=== Test Run Summary ===
Total iterations: 5
Successful: 4  
Failed: 1
Success rate: 80.0%
Total duration: 2m 15s
Average duration: 27s

Iteration timings:
✅ Iteration 1: 25s
✅ Iteration 2: 23s  
✅ Iteration 3: 31s
❌ Iteration 4: 45s
✅ Iteration 5: 21s
```

### Professional HTML Reports
- **Native Playwright styling** - Looks exactly like your regular reports
- **Multiple test runs** - All iterations grouped and displayed
- **Full trace support** - Click to view traces, screenshots, videos
- **Detailed metrics** - Success rates, timings, error details

## 🔧 How It Works

1. **Config Detection** - Finds your `playwright.config.*` file relative to the test
2. **Blob Reports** - Each iteration creates a blob report (`report-1.zip`, `report-2.zip`, etc.)
3. **Native Merging** - Uses `npx playwright merge-reports --reporter html` 
4. **Smart Cleanup** - Removes temporary files, keeps only the final merged report
5. **One-Click Access** - Prompts to open the report in your browser

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- 🐛 [Report Issues](https://github.com/playwright-community/playwright-test-repeater/issues)
- 💡 [Request Features](https://github.com/playwright-community/playwright-test-repeater/issues/new)
- 📖 [Documentation](https://github.com/playwright-community/playwright-test-repeater#readme)

---

**Made with ❤️ for the Playwright community**