type Handler = (...args: any[]) => void;

/**
 * Simple global event bus:
 * - subscribe with `on(signal, handler)`
 * - unsubscribe with `off(signal, handler)`
 * - broadcast with `emit(signal, ...args)`
 */
export default class EventBus {
  private static _instance: EventBus;

  /** Singleton-style accessor. */
  public static get I(): EventBus {
    if (!this._instance) {
      this._instance = new EventBus();
    }
    return this._instance;
  }

  private listeners: Map<string, Handler[]> = new Map();

  on(signal: string, handler: Handler) {
    const list = this.listeners.get(signal) || [];
    if (list.indexOf(handler) === -1) {
      list.push(handler);
      this.listeners.set(signal, list);
    }
  }

  off(signal: string, handler: Handler) {
    const list = this.listeners.get(signal);
    if (!list) return;

    const idx = list.indexOf(handler);
    if (idx !== -1) {
      list.splice(idx, 1);
    }
    if (list.length === 0) {
      this.listeners.delete(signal);
    }
  }

  emit(signal: string, ...args: any[]) {
    const list = this.listeners.get(signal);
    if (!list) return;

    // copy array to avoid modification during iteration
    const handlers = list.slice();
    for (const h of handlers) {
      try {
        h(...args);
      } catch (e) {
        console.error(`[EventBus] error in handler for "${signal}"`, e);
      }
    }
  }
}
