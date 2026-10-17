import fs from 'fs';
import path from 'path';

function absolute(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

export function readJson<T = unknown>(filePath: string): T {
  return JSON.parse(fs.readFileSync(absolute(filePath), 'utf-8')) as T;
}

export function readText(filePath: string): string {
  return fs.readFileSync(absolute(filePath), 'utf-8');
}

export function uniqueId(prefix = 'auto'): string {
  return `${prefix}-${Date.now()}`;
}
