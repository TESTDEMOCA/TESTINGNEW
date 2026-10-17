function stamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(message: string): void {
    console.log(`[INFO] ${stamp()} ${message}`);
  },
  step(message: string): void {
    console.log(`[STEP] ${stamp()} ${message}`);
  },
  warn(message: string): void {
    console.warn(`[WARN] ${stamp()} ${message}`);
  },
  error(message: string): void {
    console.error(`[ERROR] ${stamp()} ${message}`);
  },
};
