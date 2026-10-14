import { db } from './client';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run `fn` inside one SQLite transaction: all of it is saved, or none of it.
 *
 * `fn` must be synchronous. drizzle's expo-sqlite driver sends COMMIT as soon as
 * the callback returns, so with an `async` callback the COMMIT runs before any
 * awaited query and a later failure rolls nothing back. Inside `fn`, finish
 * every query with `.run()`, `.all()` or `.get()` instead of awaiting it.
 */
export function atomic<T>(fn: (tx: Tx) => T): T {
  return db.transaction((tx) => {
    const result = fn(tx);
    if (result && typeof (result as { then?: unknown }).then === 'function') {
      throw new Error('atomic(): the callback must be synchronous, or its writes escape the transaction.');
    }
    return result;
  }) as T;
}
