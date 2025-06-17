import * as path from 'path';
import * as fs from 'fs';

export interface PlaywrightConfig {
    headless?: boolean;
    timeout?: number;
    retries?: number;
    workers?: number;
    reporter?: string;
    testDir?: string;
    outputDir?: string;
    browsers?: string[];
    baseURL?: string;
    globalSetup?: string;
    globalTeardown?: string;
    expect?: {
        timeout?: number;
    };
    use?: {
        headless?: boolean;
        viewport?: { width: number; height: number };
        screenshot?: string;
        video?: string;
        trace?: string;
        actionTimeout?: number;
        navigationTimeout?: number;
    };
}

export class PlaywrightConfigReader {
    
    async readConfig(testPath: string, language: string, workspacePath?: string): Promise<PlaywrightConfig | null> {
        // Start from the test file directory and traverse up
        const testDir = path.dirname(testPath);
        const searchPaths = this.getSearchPaths(testDir, workspacePath);
        
        // Debug: Searching for Playwright config in paths
        
        switch (language) {
            case 'javascript':
            case 'typescript':
                return this.readJavaScriptTypeScriptConfig(searchPaths);
            case 'python':
                return this.readPythonConfig(searchPaths);
            case 'java':
                return this.readJavaConfig(searchPaths);
            case 'csharp':
                return this.readCSharpConfig(searchPaths);
            default:
                return null;
        }
    }

    getSearchPaths(testDir: string, workspacePath?: string): string[] {
        const paths: string[] = [];
        let currentDir = testDir;
        const workspaceRoot = workspacePath || process.cwd();
        
        // Traverse up from test directory to workspace root
        while (currentDir && currentDir !== path.dirname(currentDir)) {
            paths.push(currentDir);
            
            // Stop at workspace root if defined
            if (workspacePath && currentDir === workspaceRoot) {
                break;
            }
            
            currentDir = path.dirname(currentDir);
            
            // Don't go above workspace root
            if (workspacePath && !currentDir.startsWith(workspaceRoot)) {
                break;
            }
        }
        
        // Always include workspace root if not already included
        if (workspacePath && !paths.includes(workspaceRoot)) {
            paths.push(workspaceRoot);
        }
        
        return paths;
    }

    private async readJavaScriptTypeScriptConfig(searchPaths: string[]): Promise<PlaywrightConfig | null> {
        const configFiles = [
            'playwright.config.ts',
            'playwright.config.js',
            'playwright.config.mjs',
            'playwright.config.cjs',
            'tests/playwright.config.ts',
            'tests/playwright.config.js'
        ];

        for (const searchPath of searchPaths) {
            for (const configFile of configFiles) {
                const configPath = path.join(searchPath, configFile);
                if (fs.existsSync(configPath)) {
                    try {
                        const config = await this.parseJavaScriptConfig(configPath);
                        if (config) return config;
                    } catch (error) {
                        console.warn(`Failed to parse ${configFile}:`, error);
                    }
                }
            }
        }

        return null;
    }

    private async parseJavaScriptConfig(configPath: string): Promise<PlaywrightConfig | null> {
        try {
            const content = fs.readFileSync(configPath, 'utf8');
            
            // Try to extract basic config values using regex patterns
            const config: PlaywrightConfig = {};
            
            // Extract headless setting
            const headlessMatch = content.match(/headless:\s*(true|false)/);
            if (headlessMatch) {
                config.headless = headlessMatch[1] === 'true';
            }

            // Extract use.headless setting (more common)
            const useHeadlessMatch = content.match(/use:\s*{[^}]*headless:\s*(true|false)/s);
            if (useHeadlessMatch) {
                config.use = { headless: useHeadlessMatch[1] === 'true' };
            }

            // Extract timeout
            const timeoutMatch = content.match(/timeout:\s*(\d+)/);
            if (timeoutMatch) {
                config.timeout = parseInt(timeoutMatch[1]);
            }

            // Extract retries
            const retriesMatch = content.match(/retries:\s*(\d+)/);
            if (retriesMatch) {
                config.retries = parseInt(retriesMatch[1]);
            }

            // Extract workers
            const workersMatch = content.match(/workers:\s*(\d+)/);
            if (workersMatch) {
                config.workers = parseInt(workersMatch[1]);
            }

            // Extract testDir
            const testDirMatch = content.match(/testDir:\s*['"`]([^'"`]+)['"`]/);
            if (testDirMatch) {
                config.testDir = testDirMatch[1];
            }

            // Extract outputDir
            const outputDirMatch = content.match(/outputDir:\s*['"`]([^'"`]+)['"`]/);
            if (outputDirMatch) {
                config.outputDir = outputDirMatch[1];
            }

            // Extract reporter
            const reporterMatch = content.match(/reporter:\s*['"`]([^'"`]+)['"`]/);
            if (reporterMatch) {
                config.reporter = reporterMatch[1];
            }

            // Extract expect timeout
            const expectTimeoutMatch = content.match(/expect:\s*{[^}]*timeout:\s*(\d+)/s);
            if (expectTimeoutMatch) {
                config.expect = { timeout: parseInt(expectTimeoutMatch[1]) };
            }

            // Extract use.actionTimeout
            const actionTimeoutMatch = content.match(/use:\s*{[^}]*actionTimeout:\s*(\d+)/s);
            if (actionTimeoutMatch) {
                if (!config.use) config.use = {};
                config.use.actionTimeout = parseInt(actionTimeoutMatch[1]);
            }

            // Extract use.navigationTimeout
            const navigationTimeoutMatch = content.match(/use:\s*{[^}]*navigationTimeout:\s*(\d+)/s);
            if (navigationTimeoutMatch) {
                if (!config.use) config.use = {};
                config.use.navigationTimeout = parseInt(navigationTimeoutMatch[1]);
            }

            return Object.keys(config).length > 0 ? config : null;
        } catch (error) {
            return null;
        }
    }

    private async readPythonConfig(searchPaths: string[]): Promise<PlaywrightConfig | null> {
        const configFiles = [
            'pytest.ini',
            'pyproject.toml',
            'setup.cfg',
            'tox.ini'
        ];

        for (const searchPath of searchPaths) {
            for (const configFile of configFiles) {
                const configPath = path.join(searchPath, configFile);
                if (fs.existsSync(configPath)) {
                    try {
                        const config = await this.parsePythonConfig(configPath, configFile);
                        if (config) return config;
                    } catch (error) {
                        console.warn(`Failed to parse ${configFile}:`, error);
                    }
                }
            }
        }

        return null;
    }

    private async parsePythonConfig(configPath: string, fileName: string): Promise<PlaywrightConfig | null> {
        const content = fs.readFileSync(configPath, 'utf8');
        const config: PlaywrightConfig = {};

        if (fileName === 'pyproject.toml') {
            // Parse TOML for pytest-playwright settings
            const headlessMatch = content.match(/\[tool\.pytest\.ini_options\][\s\S]*?headless\s*=\s*(true|false)/);
            if (headlessMatch) {
                config.headless = headlessMatch[1] === 'true';
            }

            const browsersMatch = content.match(/\[tool\.pytest\.ini_options\][\s\S]*?browser\s*=\s*\[([^\]]+)\]/);
            if (browsersMatch) {
                config.browsers = browsersMatch[1].split(',').map(b => b.trim().replace(/['"]/g, ''));
            }
        } else {
            // Parse INI format
            const headlessMatch = content.match(/addopts.*--headed/);
            if (headlessMatch) {
                config.headless = false; // --headed means not headless
            }

            const browserMatch = content.match(/addopts.*--browser[=\s]+([^\s]+)/);
            if (browserMatch) {
                config.browsers = [browserMatch[1]];
            }
        }

        return Object.keys(config).length > 0 ? config : null;
    }

    private async readJavaConfig(searchPaths: string[]): Promise<PlaywrightConfig | null> {
        const configFiles = [
            'pom.xml',
            'build.gradle',
            'build.gradle.kts',
            'src/test/resources/application.properties',
            'src/test/resources/application.yml'
        ];

        for (const searchPath of searchPaths) {
            for (const configFile of configFiles) {
                const configPath = path.join(searchPath, configFile);
                if (fs.existsSync(configPath)) {
                    try {
                        const config = await this.parseJavaConfig(configPath, configFile);
                        if (config) return config;
                    } catch (error) {
                        console.warn(`Failed to parse ${configFile}:`, error);
                    }
                }
            }
        }

        return null;
    }

    private async parseJavaConfig(configPath: string, fileName: string): Promise<PlaywrightConfig | null> {
        const content = fs.readFileSync(configPath, 'utf8');
        const config: PlaywrightConfig = {};

        if (fileName.includes('pom.xml')) {
            // Parse Maven configuration
            const headlessMatch = content.match(/<playwright\.headless>(true|false)<\/playwright\.headless>/);
            if (headlessMatch) {
                config.headless = headlessMatch[1] === 'true';
            }

            const browserMatch = content.match(/<playwright\.browser>([^<]+)<\/playwright\.browser>/);
            if (browserMatch) {
                config.browsers = [browserMatch[1]];
            }
        } else if (fileName.includes('gradle')) {
            // Parse Gradle configuration
            const headlessMatch = content.match(/systemProperty\s*\(\s*['"]playwright\.headless['"],\s*['"]?(true|false)['"]?\s*\)/);
            if (headlessMatch) {
                config.headless = headlessMatch[1] === 'true';
            }

            const browserMatch = content.match(/systemProperty\s*\(\s*['"]playwright\.browser['"],\s*['"]([^'"]+)['"]?\s*\)/);
            if (browserMatch) {
                config.browsers = [browserMatch[1]];
            }
        } else {
            // Parse properties/YAML files
            const headlessMatch = content.match(/playwright\.headless\s*[=:]\s*(true|false)/);
            if (headlessMatch) {
                config.headless = headlessMatch[1] === 'true';
            }

            const browserMatch = content.match(/playwright\.browser\s*[=:]\s*([^\s\n]+)/);
            if (browserMatch) {
                config.browsers = [browserMatch[1]];
            }
        }

        return Object.keys(config).length > 0 ? config : null;
    }

    private async readCSharpConfig(searchPaths: string[]): Promise<PlaywrightConfig | null> {
        const configFiles = [
            'appsettings.json',
            'appsettings.Test.json',
            'runsettings.xml',
            'Directory.Build.props',
            'Directory.Build.targets'
        ];

        for (const searchPath of searchPaths) {
            for (const configFile of configFiles) {
                const configPath = path.join(searchPath, configFile);
                if (fs.existsSync(configPath)) {
                    try {
                        const config = await this.parseCSharpConfig(configPath, configFile);
                        if (config) return config;
                    } catch (error) {
                        console.warn(`Failed to parse ${configFile}:`, error);
                    }
                }
            }
        }

        return null;
    }

    private async parseCSharpConfig(configPath: string, fileName: string): Promise<PlaywrightConfig | null> {
        const content = fs.readFileSync(configPath, 'utf8');
        const config: PlaywrightConfig = {};

        if (fileName.includes('.json')) {
            try {
                const jsonConfig = JSON.parse(content);
                
                // Check for Playwright settings in various locations
                const playwrightConfig = jsonConfig.Playwright || 
                                       jsonConfig.TestSettings?.Playwright ||
                                       jsonConfig.playwright;

                if (playwrightConfig) {
                    if (typeof playwrightConfig.headless === 'boolean') {
                        config.headless = playwrightConfig.headless;
                    }
                    if (playwrightConfig.browser) {
                        config.browsers = Array.isArray(playwrightConfig.browser) 
                            ? playwrightConfig.browser 
                            : [playwrightConfig.browser];
                    }
                    if (typeof playwrightConfig.timeout === 'number') {
                        config.timeout = playwrightConfig.timeout;
                    }
                }
            } catch (error) {
                // JSON parsing failed, try regex fallback
                const headlessMatch = content.match(/"[Hh]eadless"\s*:\s*(true|false)/);
                if (headlessMatch) {
                    config.headless = headlessMatch[1] === 'true';
                }
            }
        } else {
            // Parse XML/props files
            const headlessMatch = content.match(/<PlaywrightHeadless>(true|false)<\/PlaywrightHeadless>/);
            if (headlessMatch) {
                config.headless = headlessMatch[1] === 'true';
            }

            const browserMatch = content.match(/<PlaywrightBrowser>([^<]+)<\/PlaywrightBrowser>/);
            if (browserMatch) {
                config.browsers = [browserMatch[1]];
            }
        }

        return Object.keys(config).length > 0 ? config : null;
    }

    // Helper method to determine the effective headless setting
    getEffectiveHeadless(config: PlaywrightConfig): boolean {
        // Priority: use.headless > headless > default (true for headless)
        if (config.use?.headless !== undefined) {
            return config.use.headless;
        }
        if (config.headless !== undefined) {
            return config.headless;
        }
        return true; // Default to headless
    }
}