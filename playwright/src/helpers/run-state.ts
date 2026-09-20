import * as fs from 'fs';
import * as path from 'path';

const stateFile = path.resolve(__dirname, '../../.run-state.json');

export interface RunState {
    recordSummaryUrl?: string;
    requestId?: string;
}

export function saveRunState(state: RunState): void {
    const merged = { ...loadRunState(), ...state };
    fs.writeFileSync(stateFile, JSON.stringify(merged, null, 2));
}

export function loadRunState(): RunState {
    if (!fs.existsSync(stateFile)) return {};
    return JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as RunState;
}

export function clearRunState(): void {
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
}
