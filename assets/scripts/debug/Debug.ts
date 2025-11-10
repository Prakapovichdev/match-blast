let DEBUG_ENABLED = false;

export function setDebug(value: boolean) {
  DEBUG_ENABLED = value;
}

export function debugLog(tag: string, ...args: any[]) {
  if (!DEBUG_ENABLED) return;
  cc.log(`[${tag}]`, ...args);
}
