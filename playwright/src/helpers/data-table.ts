import { DataTable } from 'playwright-bdd';

export function columnValues(table: DataTable): string[] {
    return table.raw().flat().map((cell) => cell.trim()).filter(Boolean);
}
