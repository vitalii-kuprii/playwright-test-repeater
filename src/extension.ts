import * as vscode from 'vscode';
import { PlaywrightTestRunner } from './playwright-runner';
import { TestConfigManager } from './config-manager';
import { TestCodeLensProvider } from './test-codelens-provider';

export function activate(context: vscode.ExtensionContext) {
    const testRunner = new PlaywrightTestRunner();
    const configManager = new TestConfigManager();
    const codeLensProvider = new TestCodeLensProvider();

    // Register CodeLens provider for all supported languages
    const languages = ['javascript', 'typescript', 'python', 'java', 'csharp'];
    languages.forEach(language => {
        context.subscriptions.push(
            vscode.languages.registerCodeLensProvider(language, codeLensProvider)
        );
    });

    // Register commands for running tests multiple times
    const runTest3Times = vscode.commands.registerCommand(
        'playwright-test-repeater.runTest3Times',
        async (uri: vscode.Uri, testName: string, lineNumber: number) => {
            await testRunner.runSpecificTest(uri, testName, 3);
        }
    );

    const runTest5Times = vscode.commands.registerCommand(
        'playwright-test-repeater.runTest5Times',
        async (uri: vscode.Uri, testName: string, lineNumber: number) => {
            await testRunner.runSpecificTest(uri, testName, 5);
        }
    );

    const runTest10Times = vscode.commands.registerCommand(
        'playwright-test-repeater.runTest10Times',
        async (uri: vscode.Uri, testName: string, lineNumber: number) => {
            await testRunner.runSpecificTest(uri, testName, 10);
        }
    );

    const configureTestRuns = vscode.commands.registerCommand(
        'playwright-test-repeater.configureTestRuns',
        async () => {
            await configManager.showConfigurationDialog();
        }
    );

    context.subscriptions.push(
        runTest3Times,
        runTest5Times,
        runTest10Times,
        configureTestRuns
    );
}

export function deactivate() {}