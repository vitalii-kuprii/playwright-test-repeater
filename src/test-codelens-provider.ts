import * as vscode from 'vscode';

export class TestCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];
        const language = this.getLanguageType(document.fileName);
        const testPatterns = this.getTestPatterns(language);

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text;

            for (const pattern of testPatterns) {
                const match = text.match(pattern);
                if (match) {
                    const testName = match[1];
                    const range = new vscode.Range(i, 0, i, text.length);
                    
                    // Create three CodeLens buttons for each test
                    const runCountButtons = [3, 5, 10];
                    const startChar = text.indexOf(match[0]);
                    
                    runCountButtons.forEach((count, index) => {
                        const buttonRange = new vscode.Range(
                            i,
                            startChar + match[0].length + (index * 2),
                            i,
                            startChar + match[0].length + (index * 2) + 1
                        );
                        
                        const codeLens = new vscode.CodeLens(buttonRange, {
                            title: `Run ${count}x`,
                            command: `playwright-test-repeater.runTest${count}Times`,
                            arguments: [document.uri, testName, i]
                        });
                        
                        codeLenses.push(codeLens);
                    });
                    break; // Only match first pattern per line
                }
            }
        }

        return codeLenses;
    }

    private getLanguageType(fileName: string): string {
        const ext = fileName.split('.').pop()?.toLowerCase();
        
        switch (ext) {
            case 'py': return 'python';
            case 'java': return 'java';
            case 'cs': return 'csharp';
            case 'js':
            case 'jsx':
            case 'ts':
            case 'tsx':
            default:
                return 'javascript';
        }
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
            default: // JavaScript/TypeScript
                return [
                    /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/,
                    /(?:test|it)\.(?:skip|only)\s*\(\s*['"`]([^'"`]+)['"`]/
                ];
        }
    }

    refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }
}