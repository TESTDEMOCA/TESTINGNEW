import type { ScenarioData } from '../types';
import { endDateNonSma } from './endDate.nonSma';
import { rerateNonSmaPhysicals } from './rerate.nonSma.physicals';
import { updateAccountSetupNonSma } from './updateAccountSetup.nonSma';

export const scenarios: Record<string, ScenarioData> = {
    'rerate.nonSma.physicals': rerateNonSmaPhysicals,
    'updateAccountSetup.nonSma': updateAccountSetupNonSma,
    'endDate.nonSma': endDateNonSma,
};

export function getScenario(key: string): ScenarioData {
    const data = scenarios[key];
    if (!data) {
        throw new Error(
            `Unknown test data key "${key}". Known keys: ${Object.keys(scenarios).join(', ')}`
        );
    }
    return data;
}
