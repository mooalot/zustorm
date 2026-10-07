import {
  createProxy,
  getUntracked,
  isChanged,
  markToTrack,
} from 'proxy-compare';
import { StateCreator, StoreMutatorIdentifier } from 'zustand';

type Computed = <T extends object>(
  /**
   * The function that computes the derived state.
   */
  compute: Compute<T>
) => <
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  creator: StateCreator<T, [...Mps], Mcs>
) => StateCreator<T, Mps, [...Mcs]>;

/**
 * Computes the derived part of `state`. `external` is true when the state was
 * written past this middleware (an outer middleware's raw `set`, such as
 * persist hydration or devtools time travel) rather than through `setState`.
 */
type Compute<T> = (state: T, prev: T, external: boolean) => Partial<T>;

export const createComputer =
  createComputerImplementation as unknown as Computed;

function createComputerImplementation<T extends object>(
  compute: Compute<T>
): (creator: StateCreator<T>) => StateCreator<T> {
  return (creator) => {
    return (set, get, api) => {
      let affected = new WeakMap();
      const proxyCache = new WeakMap();
      const targetCache = new WeakMap();
      const compareCache = new WeakMap();

      let proxyState = {} as T;

      function runCompute(state: T, prev: T, external: boolean): Partial<T> {
        proxyState = { ...state };
        affected = new WeakMap();
        for (const key in proxyState) {
          const value = proxyState[key];
          if (typeof value === 'object' && value !== null)
            markToTrack(value, false);
        }
        const proxy = createProxy(
          proxyState,
          affected,
          proxyCache,
          targetCache
        );
        const computed = compute(proxy, prev, external);
        return getUntracked(computed) ?? computed;
      }

      const trackedChanged = (next: T) =>
        isChanged(proxyState, next, affected, compareCache, Object.is);

      // Writes made here are recognised by the subscription below, so only
      // writes from elsewhere are treated as external.
      let writing = false;
      const write = (partial: Partial<T>, replace?: boolean) => {
        writing = true;
        try {
          set(partial as T, replace as true);
        } finally {
          writing = false;
        }
      };

      const setWithComputed: typeof set = (partial, replace) => {
        const prev = get();
        const nextPartial =
          typeof partial === 'function' ? partial(prev) : partial;
        const merged = replace
          ? (nextPartial as T)
          : { ...prev, ...nextPartial };

        if (trackedChanged(merged)) {
          const computed = runCompute(merged, prev, false);
          write({ ...nextPartial, ...computed }, replace);
          // Keep the comparison baseline equal to what was stored, so the next
          // update is compared against the computed state, not the input.
          Object.assign(proxyState, computed);
        } else {
          write(nextPartial, replace);
        }
      };

      Object.assign(api, {
        setState: setWithComputed,
      });

      // A write that bypassed `setState` (persist hydration, devtools time
      // travel, an outer middleware calling its raw `set`) is adopted as is:
      // the derived state is brought up to date without being re-tracked.
      api.subscribe((state, prev) => {
        if (writing || !trackedChanged(state)) return;
        const computed = runCompute(state, prev, true);
        Object.assign(proxyState, computed);
        if (Object.keys(computed).length > 0) write(computed);
      });

      const initialState = creator(setWithComputed, get, api);
      const initialComputed = runCompute(initialState, get(), false);
      Object.assign(proxyState, initialComputed);
      return { ...initialState, ...initialComputed };
    };
  };
}
