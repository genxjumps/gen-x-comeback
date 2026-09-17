// Only explicitly marked pre-provider database work may fail independently.
// Provider calls, reservations and evidence writes must never be wrapped here.
export class RecoverableQueueError extends Error {
  constructor(readonly operation: string) {
    super("email_queue_preparation_failed");
  }
}
export async function prepareEmail<T>(operation: string, work: () => PromiseLike<T>): Promise<T> {
  try {
    return await work();
  } catch {
    throw new RecoverableQueueError(operation);
  }
}
export function isolatePreparation<T extends object>(store: T, methods: Array<keyof T>): T {
  return new Proxy(store, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (!methods.includes(key as keyof T) || typeof value !== "function") return value;
      return (...args: unknown[]) =>
        prepareEmail(String(key), () => Reflect.apply(value, target, args));
    },
  });
}
export type QueueRunner = <T>(name: string, work: () => Promise<T>, empty: T) => Promise<T>;
export function createQueueRunner(
  report: (queue: string, operation: string | null) => Promise<void>,
) {
  const failures: string[] = [];
  async function record(name: string, operation: string | null) {
    try {
      await report(name, operation);
    } catch {
      failures.push("monitoring");
      console.error("email_queue_monitoring_unavailable", { queue: name });
    }
  }
  const run: QueueRunner = async (name, work, empty) => {
    try {
      const result = await work();
      await record(name, null);
      return result;
    } catch (error) {
      if (!(error instanceof RecoverableQueueError)) throw error;
      failures.push(name);
      await record(name, error.operation);
      return empty;
    }
  };
  return { run, failures };
}
