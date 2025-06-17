import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import * as treeKill from 'tree-kill';
import { PlaywrightConfigReader, PlaywrightConfig } from './playwright-config-reader';

interface TestResult {
    iteration: number;
    success: boolean;
    duration: number;
    error?: string;
}

export class PlaywrightTestRunner {
    private currentProcess: ChildProcess | null = null;
    private configReader: PlaywrightConfigReader = new PlaywrightConfigReader();

    async runTestFile(uri: vscode.Uri): Promise<void> {
        const config = vscode.workspace.getConfiguration('playwright-test-repeater');
        const iterations = await this.getIterationsFromUser(config.get('defaultIterations', 5));
        
        if (iterations <= 0) {
            return;
        }

        const testFilePath = uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        await this.runTestIterations(testFilePath, iterations, workspaceFolder.uri.fsPath);
    }

    async runCurrentTest(editor: vscode.TextEditor): Promise<void> {
        const document = editor.document;
        const position = editor.selection.active;
        const testName = this.findTestAtPosition(document, position);
        
        if (!testName) {
            vscode.window.showWarningMessage('No test found at current position');
            return;
        }

        const config = vscode.workspace.getConfiguration('playwright-test-repeater');
        const iterations = await this.getIterationsFromUser(config.get('defaultIterations', 5));
        
        if (iterations <= 0) {
            return;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        await this.runTestIterations(
            document.uri.fsPath, 
            iterations, 
            workspaceFolder.uri.fsPath,
            testName
        );
    }

    async runSpecificTest(uri: vscode.Uri, testName: string, iterations: number): Promise<void> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        await this.runTestIterations(uri.fsPath, iterations, workspaceFolder.uri.fsPath, testName);
    }

    private async getIterationsFromUser(defaultValue: number): Promise<number> {
        const input = await vscode.window.showInputBox({
            prompt: 'How many times should the test run?',
            value: defaultValue.toString(),
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num <= 0) {
                    return 'Please enter a positive number';
                }
                return null;
            }
        });

        return input ? parseInt(input) : 0;
    }

    private findTestAtPosition(document: vscode.TextDocument, position: vscode.Position): string | null {
        const language = this.getLanguageType(document.fileName);
        const testPatterns = this.getTestPatterns(language);
        
        for (let i = position.line; i >= 0; i--) {
            const line = document.lineAt(i).text;
            for (const pattern of testPatterns) {
                const match = line.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }
        }
        
        return null;
    }

    private getLanguageType(fileName: string): string {
        const ext = path.extname(fileName);
        if (ext === '.py') return 'python';
        if (ext === '.java') return 'java';
        if (ext === '.cs') return 'csharp';
        return 'javascript';
    }

    private getTestPatterns(language: string): RegExp[] {
        switch (language) {
            case 'python':
                return [
                    /def\s+(test_\w+)/,
                    /async\s+def\s+(test_\w+)/
                ];
            case 'java':
                return [
                    /@Test[\s\S]*?(?:public|private)?\s*void\s+(\w+)/,
                    /void\s+(\w+)\s*\(\s*\)\s*{/
                ];
            case 'csharp':
                return [
                    /\[Test\][\s\S]*?(?:public|private)?\s*(?:async\s+)?(?:Task\s+)?(\w+)/,
                    /public\s+(?:async\s+)?(?:Task\s+)?(\w+)\s*\(\s*\)/
                ];
            default:
                return [
                    /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/,
                    /(?:test|it)\.(?:skip|only)\s*\(\s*['"`]([^'"`]+)['"`]/
                ];
        }
    }

    private async runTestIterations(
        testPath: string, 
        iterations: number, 
        workspacePath: string,
        testName?: string
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration('playwright-test-repeater');
        const stopOnFirstFailure = config.get('stopOnFirstFailure', false);
        const showProgress = config.get('showProgress', true);

        const results: TestResult[] = [];
        const outputChannel = vscode.window.createOutputChannel('Playwright Test Repeater');
        outputChannel.show();

        const progress = showProgress ? vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Running test ${iterations} times`,
            cancellable: true
        }, async (progress, token) => {
            return this.executeIterations(
                testPath, iterations, workspacePath, testName,
                results, outputChannel, progress, token, stopOnFirstFailure
            );
        }) : this.executeIterations(
            testPath, iterations, workspacePath, testName,
            results, outputChannel, null, null, stopOnFirstFailure
        );

        await progress;
        
        // Merge HTML reports if available
        await this.mergeReports(testPath, iterations, workspacePath, testName, outputChannel);
        
        this.showResults(results, outputChannel);
    }

    private async executeIterations(
        testPath: string,
        iterations: number,
        workspacePath: string,
        testName: string | undefined,
        results: TestResult[],
        outputChannel: vscode.OutputChannel,
        progress: vscode.Progress<{message?: string; increment?: number}> | null,
        token: vscode.CancellationToken | null,
        stopOnFirstFailure: boolean
    ): Promise<void> {
        for (let i = 1; i <= iterations; i++) {
            if (token?.isCancellationRequested) {
                outputChannel.appendLine(`Test execution cancelled at iteration ${i}`);
                break;
            }

            progress?.report({
                message: `Running iteration ${i}/${iterations}`,
                increment: (100 / iterations)
            });

            outputChannel.appendLine(`\n=== Iteration ${i}/${iterations} ===`);
            
            const startTime = Date.now();
            const result = await this.runSingleTest(testPath, workspacePath, testName, outputChannel, i);
            const duration = Date.now() - startTime;

            results.push({
                iteration: i,
                success: result.success,
                duration,
                error: result.error
            });

            if (!result.success && stopOnFirstFailure) {
                outputChannel.appendLine(`Stopping execution due to failure at iteration ${i}`);
                break;
            }
        }
    }

    private async runSingleTest(
        testPath: string, 
        workspacePath: string, 
        testName?: string,
        outputChannel?: vscode.OutputChannel,
        iteration?: number
    ): Promise<{success: boolean; error?: string}> {
        return new Promise(async (resolve) => {
            const language = this.getLanguageType(testPath);
            
            // Read Playwright config for logging
            const playwrightConfig = await this.configReader.readConfig(testPath, language, workspacePath);
            
            const command = await this.buildTestCommand(language, testPath, testName, workspacePath, iteration);
            
            outputChannel?.appendLine(`Executing: ${command.join(' ')}`);
            outputChannel?.appendLine(`Working directory: ${workspacePath}`);
            outputChannel?.appendLine(`Test file: ${testPath}`);
            outputChannel?.appendLine(`Test directory: ${path.dirname(testPath)}`);
            
            // Show config information
            if (playwrightConfig) {
                outputChannel?.appendLine(`Using Playwright config: headless=${this.configReader.getEffectiveHeadless(playwrightConfig)}`);
                if (playwrightConfig.timeout) {
                    outputChannel?.appendLine(`Config timeout: ${playwrightConfig.timeout}ms`);
                }
                if (playwrightConfig.expect?.timeout) {
                    outputChannel?.appendLine(`Config expect timeout: ${playwrightConfig.expect.timeout}ms`);
                }
                if (playwrightConfig.use?.actionTimeout) {
                    outputChannel?.appendLine(`Config action timeout: ${playwrightConfig.use.actionTimeout}ms`);
                }
                if (playwrightConfig.browsers) {
                    outputChannel?.appendLine(`Config browsers: ${playwrightConfig.browsers.join(', ')}`);
                }
                if (playwrightConfig.reporter) {
                    outputChannel?.appendLine(`Config reporter: ${playwrightConfig.reporter}`);
                }
            } else {
                outputChannel?.appendLine(`No Playwright config found, using extension defaults`);
            }
            
            // Inherit environment variables and load .env files
            const env = { ...process.env };
            const envVars = this.loadEnvFiles(workspacePath);
            Object.assign(env, envVars);
            
            if (!env.NODE_ENV) {
                env.NODE_ENV = 'test';
            }
            
            // Set blob report output for this iteration (for proper merging)
            if (iteration && workspacePath) {
                const blobReportDir = path.join(workspacePath, 'blob-report');
                const iterationBlobFile = path.join(blobReportDir, `report-${iteration}.zip`);
                
                // Ensure blob report directory exists
                if (!fs.existsSync(blobReportDir)) {
                    fs.mkdirSync(blobReportDir, { recursive: true });
                }
                
                env.PLAYWRIGHT_BLOB_OUTPUT_FILE = iterationBlobFile;
                outputChannel?.appendLine(`Blob report output: ${iterationBlobFile}`);
            }
            
            // Debug output
            const envKeysCount = Object.keys(envVars).length;
            outputChannel?.appendLine(`Loaded ${envKeysCount} environment variables from .env files`);
            if (envKeysCount > 0) {
                outputChannel?.appendLine(`Env vars loaded: ${Object.keys(envVars).join(', ')}`);
            }
            
            this.currentProcess = spawn(command[0], command.slice(1), {
                cwd: workspacePath,
                shell: true,
                env: env,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';

            this.currentProcess.stdout?.on('data', (data) => {
                const text = data.toString();
                output += text;
                outputChannel?.append(text);
            });

            this.currentProcess.stderr?.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                outputChannel?.append(text);
            });

            this.currentProcess.on('close', (code) => {
                this.currentProcess = null;
                const success = code === 0;
                resolve({
                    success,
                    error: success ? undefined : errorOutput || 'Test failed'
                });
            });

            this.currentProcess.on('error', (error) => {
                this.currentProcess = null;
                resolve({
                    success: false,
                    error: error.message
                });
            });
        });
    }

    private async buildTestCommand(
        language: string, 
        testPath: string, 
        testName?: string, 
        workspacePath?: string,
        iteration?: number
    ): Promise<string[]> {
        const relativePath = path.relative(workspacePath || process.cwd(), testPath);
        const extensionConfig = vscode.workspace.getConfiguration('playwright-test-repeater');
        
        // Read Playwright configuration file starting from test directory
        let playwrightConfig: PlaywrightConfig | null = null;
        playwrightConfig = await this.configReader.readConfig(testPath, language, workspacePath);
        
        // Determine headless setting: Playwright config overrides extension config
        let runHeaded = extensionConfig.get('runHeaded', true);
        if (playwrightConfig) {
            const configHeadless = this.configReader.getEffectiveHeadless(playwrightConfig);
            runHeaded = !configHeadless; // Invert because headless=false means headed=true
        }
        
        // Configuration loaded and applied
        
        switch (language) {
            case 'python':
                const pythonArgs = ['python', '-m', 'pytest'];
                
                // Add headless/headed flag for Python
                if (runHeaded) {
                    pythonArgs.push('--headed');
                }
                
                // Add browsers if specified in config
                if (playwrightConfig?.browsers) {
                    for (const browser of playwrightConfig.browsers) {
                        pythonArgs.push('--browser', browser);
                    }
                }
                
                if (testName) {
                    pythonArgs.push(`${relativePath}::${testName}`, '-v');
                } else {
                    pythonArgs.push(relativePath, '-v');
                }
                
                return pythonArgs;
            
            case 'java':
                const javaArgs = ['mvn', 'test'];
                
                // Add system properties for Playwright config
                if (playwrightConfig?.headless !== undefined) {
                    javaArgs.push(`-Dplaywright.headless=${!runHeaded}`);
                }
                
                if (playwrightConfig?.browsers && playwrightConfig.browsers.length > 0) {
                    javaArgs.push(`-Dplaywright.browser=${playwrightConfig.browsers[0]}`);
                }
                
                if (testName) {
                    javaArgs.push(`-Dtest=${testName}`);
                } else {
                    javaArgs.push(`-Dtest=${path.basename(testPath, '.java')}`);
                }
                
                return javaArgs;
            
            case 'csharp':
                const csharpArgs = ['dotnet', 'test'];
                
                // Add environment variables for Playwright config
                if (playwrightConfig?.headless !== undefined) {
                    csharpArgs.push('--environment', `PLAYWRIGHT_HEADLESS=${!runHeaded ? 'true' : 'false'}`);
                }
                
                if (playwrightConfig?.browsers && playwrightConfig.browsers.length > 0) {
                    csharpArgs.push('--environment', `PLAYWRIGHT_BROWSER=${playwrightConfig.browsers[0]}`);
                }
                
                if (testName) {
                    csharpArgs.push('--filter', `Name=${testName}`);
                } else {
                    csharpArgs.push(relativePath);
                }
                
                return csharpArgs;
            
            default: // JavaScript/TypeScript
                // Try to use npm/yarn script if available, otherwise use npx directly
                const hasPackageJson = this.hasPackageJson(workspacePath);
                
                // Build command flags - use full config but force no parallelism
                const additionalFlags: string[] = [];
                
                // Force workers=1 to prevent parallel execution across test runs
                additionalFlags.push('--workers', '1');
                
                // Use blob reporter for proper merging support
                additionalFlags.push('--reporter', 'blob');
                
                // Add config file if found to use all user settings
                const configPath = await this.findConfigFilePath(testPath, workspacePath);
                if (configPath) {
                    additionalFlags.push('--config', configPath);
                }
                
                // Override headed mode if extension setting differs from config
                if (runHeaded && playwrightConfig && this.configReader.getEffectiveHeadless(playwrightConfig)) {
                    additionalFlags.push('--headed');
                } else if (!runHeaded && playwrightConfig && !this.configReader.getEffectiveHeadless(playwrightConfig)) {
                    additionalFlags.push('--headless');
                }
                
                if (hasPackageJson) {
                    if (testName) {
                        const escapedTestName = testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const args = ['npm', 'run', 'test', '--', ...additionalFlags, '--grep', `"${escapedTestName}"`];
                        return args;
                    }
                    const args = ['npm', 'run', 'test', '--', ...additionalFlags, relativePath];
                    return args;
                } else {
                    if (testName) {
                        const escapedTestName = testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const args = ['npx', 'playwright', 'test', ...additionalFlags, '--grep', `"${escapedTestName}"`];
                        return args;
                    }
                    const args = ['npx', 'playwright', 'test', ...additionalFlags, relativePath];
                    return args;
                }
        }
    }

    private hasPackageJson(workspacePath?: string): boolean {
        if (!workspacePath) return false;
        try {
            const packageJsonPath = path.join(workspacePath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                return packageJson.scripts && (packageJson.scripts.test || packageJson.scripts['test:playwright']);
            }
        } catch (error) {
            // Ignore errors and fall back to npx
        }
        return false;
    }

    private async findConfigFilePath(testPath: string, workspacePath?: string): Promise<string | null> {
        const testDir = path.dirname(testPath);
        const searchPaths = this.configReader.getSearchPaths(testDir, workspacePath);
        
        const configFiles = [
            'playwright.config.ts',
            'playwright.config.js',
            'playwright.config.mjs',
            'playwright.config.cjs'
        ];

        for (const searchPath of searchPaths) {
            for (const configFile of configFiles) {
                const configPath = path.join(searchPath, configFile);
                if (fs.existsSync(configPath)) {
                    return configPath;
                }
            }
        }

        return null;
    }


    private loadEnvFiles(workspacePath: string): Record<string, string> {
        const envVars: Record<string, string> = {};
        
        // Common .env file patterns to check
        const envFiles = [
            '.env',
            '.env.local',
            '.env.test',
            '.env.test.local'
        ];

        for (const envFile of envFiles) {
            try {
                const envFilePath = path.join(workspacePath, envFile);
                if (fs.existsSync(envFilePath)) {
                    const content = fs.readFileSync(envFilePath, 'utf8');
                    const parsed = this.parseEnvFile(content);
                    Object.assign(envVars, parsed);
                }
            } catch (error) {
                // Continue if env file can't be read
            }
        }

        return envVars;
    }

    private parseEnvFile(content: string): Record<string, string> {
        const envVars: Record<string, string> = {};
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const match = trimmed.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let value = match[2].trim();
                    
                    // Remove quotes if present
                    if ((value.startsWith('"') && value.endsWith('"')) || 
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                    
                    envVars[key] = value;
                }
            }
        }

        return envVars;
    }

    private async mergeReports(
        testPath: string, 
        iterations: number, 
        workspacePath: string, 
        testName?: string, 
        outputChannel?: vscode.OutputChannel
    ): Promise<void> {
        try {
            const blobReportDir = path.join(workspacePath, 'blob-report');
            
            if (!fs.existsSync(blobReportDir)) {
                outputChannel?.appendLine('No blob reports found to merge');
                return;
            }

            outputChannel?.appendLine('\n=== Merging Playwright Reports ===');
            
            // Get the final report directory from config or use default
            const playwrightConfig = await this.configReader.readConfig(testPath, this.getLanguageType(testPath), workspacePath);
            const finalReportDir = this.getFinalReportDirectory(playwrightConfig, workspacePath);
            
            // Clean up old reports first
            await this.cleanupOldReports(finalReportDir, outputChannel);
            
            // Use Playwright's merge-reports command
            const success = await this.runPlaywrightMergeReports(blobReportDir, finalReportDir, workspacePath, outputChannel);
            
            if (success) {
                const indexPath = path.join(finalReportDir, 'index.html');
                if (fs.existsSync(indexPath)) {
                    outputChannel?.appendLine(`Merged report available at: ${indexPath}`);
                    
                    // Ask user if they want to open the report
                    const openReport = await vscode.window.showInformationMessage(
                        `HTML report with ${iterations} iterations generated. Open in browser?`,
                        'Open Report', 
                        'Show Path'
                    );
                    
                    if (openReport === 'Open Report') {
                        vscode.env.openExternal(vscode.Uri.file(indexPath));
                    } else if (openReport === 'Show Path') {
                        vscode.window.showInformationMessage(`Report: ${indexPath}`);
                    }
                }
            }
            
            // Clean up blob reports to avoid source control issues
            await this.cleanupBlobReports(blobReportDir, outputChannel);
            
        } catch (error) {
            outputChannel?.appendLine(`Report merging failed: ${error}`);
        }
    }

    private getFinalReportDirectory(playwrightConfig: PlaywrightConfig | null, workspacePath: string): string {
        // Try to get report directory from config
        if (playwrightConfig?.outputDir) {
            return path.resolve(workspacePath, playwrightConfig.outputDir);
        }
        
        // Default to playwright-report
        return path.join(workspacePath, 'playwright-report');
    }

    private async cleanupOldReports(reportDir: string, outputChannel?: vscode.OutputChannel): Promise<void> {
        if (fs.existsSync(reportDir)) {
            outputChannel?.appendLine(`Cleaning up old reports in: ${reportDir}`);
            fs.rmSync(reportDir, { recursive: true, force: true });
        }
    }

    private async runPlaywrightMergeReports(
        blobReportDir: string, 
        outputDir: string, 
        workspacePath: string,
        outputChannel?: vscode.OutputChannel
    ): Promise<boolean> {
        return new Promise((resolve) => {
            const command = ['npx', 'playwright', 'merge-reports', '--reporter', 'html', blobReportDir];
            
            outputChannel?.appendLine(`Executing: ${command.join(' ')}`);
            outputChannel?.appendLine(`Output directory: ${outputDir}`);
            
            const mergeProcess = spawn(command[0], command.slice(1), {
                cwd: workspacePath,
                shell: true,
                env: {
                    ...process.env,
                    PLAYWRIGHT_HTML_REPORT: outputDir
                }
            });

            let output = '';
            let errorOutput = '';

            mergeProcess.stdout?.on('data', (data) => {
                const text = data.toString();
                output += text;
                outputChannel?.append(text);
            });

            mergeProcess.stderr?.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                outputChannel?.append(text);
            });

            mergeProcess.on('close', (code) => {
                const success = code === 0;
                if (!success) {
                    outputChannel?.appendLine(`Merge reports failed with code: ${code}`);
                    outputChannel?.appendLine(`Error: ${errorOutput}`);
                }
                resolve(success);
            });

            mergeProcess.on('error', (error) => {
                outputChannel?.appendLine(`Merge reports error: ${error.message}`);
                resolve(false);
            });
        });
    }

    private async cleanupBlobReports(blobReportDir: string, outputChannel?: vscode.OutputChannel): Promise<void> {
        try {
            if (fs.existsSync(blobReportDir)) {
                outputChannel?.appendLine(`Cleaning up blob reports: ${blobReportDir}`);
                fs.rmSync(blobReportDir, { recursive: true, force: true });
            }
        } catch (error) {
            outputChannel?.appendLine(`Warning: Could not cleanup blob reports: ${error}`);
        }
    }

    private formatDuration(ms: number): string {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    }

    private showResults(results: TestResult[], outputChannel: vscode.OutputChannel): void {
        const totalTests = results.length;
        const successfulTests = results.filter(r => r.success).length;
        const failedTests = totalTests - successfulTests;
        const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
        const averageDuration = totalDuration / totalTests;

        const summary = `
=== Test Run Summary ===
Total iterations: ${totalTests}
Successful: ${successfulTests}
Failed: ${failedTests}
Success rate: ${((successfulTests / totalTests) * 100).toFixed(1)}%
Total duration: ${this.formatDuration(totalDuration)}
Average duration: ${this.formatDuration(averageDuration)}
`;

        outputChannel.appendLine(summary);
        
        // Show detailed timing for each iteration
        outputChannel.appendLine('\nIteration timings:');
        results.forEach(r => {
            const status = r.success ? '✅' : '❌';
            outputChannel.appendLine(`  ${status} Iteration ${r.iteration}: ${this.formatDuration(r.duration)}`);
        });
        
        if (failedTests > 0) {
            outputChannel.appendLine('\nFailed iterations:');
            results.filter(r => !r.success).forEach(r => {
                outputChannel.appendLine(`  ❌ Iteration ${r.iteration}: ${r.error}`);
            });
        }

        const message = `Test completed: ${successfulTests}/${totalTests} iterations passed (${this.formatDuration(totalDuration)})`;
        if (failedTests === 0) {
            vscode.window.showInformationMessage(message);
        } else {
            vscode.window.showWarningMessage(message);
        }
    }

    dispose(): void {
        if (this.currentProcess) {
            treeKill(this.currentProcess.pid!);
            this.currentProcess = null;
        }
    }
}