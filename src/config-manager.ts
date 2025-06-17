import * as vscode from 'vscode';

export class TestConfigManager {
    async showConfigurationDialog(): Promise<void> {
        const config = vscode.workspace.getConfiguration('playwright-test-repeater');
        
        const options = [
            'Set Default Iterations',
            'Toggle Progress Display',
            'Toggle Stop on First Failure',
            'Toggle Headed Mode',
            'View Current Settings'
        ];

        const selection = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select configuration option'
        });

        if (!selection) {
            return;
        }

        switch (selection) {
            case 'Set Default Iterations':
                await this.setDefaultIterations(config);
                break;
            case 'Toggle Progress Display':
                await this.toggleProgressDisplay(config);
                break;
            case 'Toggle Stop on First Failure':
                await this.toggleStopOnFirstFailure(config);
                break;
            case 'Toggle Headed Mode':
                await this.toggleHeadedMode(config);
                break;
            case 'View Current Settings':
                this.showCurrentSettings(config);
                break;
        }
    }

    private async setDefaultIterations(config: vscode.WorkspaceConfiguration): Promise<void> {
        const current = config.get('defaultIterations', 5);
        const input = await vscode.window.showInputBox({
            prompt: 'Enter default number of iterations',
            value: current.toString(),
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num <= 0) {
                    return 'Please enter a positive number';
                }
                return null;
            }
        });

        if (input) {
            const newValue = parseInt(input);
            await config.update('defaultIterations', newValue, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`Default iterations set to ${newValue}`);
        }
    }

    private async toggleProgressDisplay(config: vscode.WorkspaceConfiguration): Promise<void> {
        const current = config.get('showProgress', true);
        await config.update('showProgress', !current, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Progress display ${!current ? 'enabled' : 'disabled'}`);
    }

    private async toggleStopOnFirstFailure(config: vscode.WorkspaceConfiguration): Promise<void> {
        const current = config.get('stopOnFirstFailure', false);
        await config.update('stopOnFirstFailure', !current, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Stop on first failure ${!current ? 'enabled' : 'disabled'}`);
    }

    private async toggleHeadedMode(config: vscode.WorkspaceConfiguration): Promise<void> {
        const current = config.get('runHeaded', true);
        await config.update('runHeaded', !current, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Headed mode ${!current ? 'enabled' : 'disabled'}`);
    }

    private showCurrentSettings(config: vscode.WorkspaceConfiguration): void {
        const defaultIterations = config.get('defaultIterations', 5);
        const showProgress = config.get('showProgress', true);
        const stopOnFirstFailure = config.get('stopOnFirstFailure', false);
        const runHeaded = config.get('runHeaded', true);

        const settings = `
Current Playwright Test Runner Settings:
• Default Iterations: ${defaultIterations}
• Show Progress: ${showProgress ? 'Yes' : 'No'}
• Stop on First Failure: ${stopOnFirstFailure ? 'Yes' : 'No'}
• Run Headed: ${runHeaded ? 'Yes' : 'No'}
        `;

        vscode.window.showInformationMessage(settings);
    }
}