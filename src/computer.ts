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
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  creator: StateCreator<T, [...Mps], Mcs>
) => StateCreator<T, Mps, [...Mcs]>;

type Compute<T> = (state: T) => Partial<T>;

export const createComputer =
  createComputerImplementation as unknown as Computed;

function createComputerImplementation<T extends object>(
  compute: (state: T) => Partial<T>
): (creator: StateCreator<T>) => StateCreator<T> {
  return (creator) => {
    return (set, get, api) => {
      let affected = new WeakMap();
      const proxyCache = new WeakMap();
      const targetCache = new WeakMap();
      const compareCache = new WeakMap();

      let proxyState: T;

      function runCompute(state: Partial<T>): Partial<T> {
        proxyState = { ...get(), ...state };
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
        const computed = compute(proxy);
        return getUntracked(computed) ?? computed;
      }

      const setWithComputed: typeof set = (partial, replace) => {
        const nextPartial =
          typeof partial === 'function' ? partial(get()) : partial;

        const merged = { ...get(), ...nextPartial };

        const touched = isChanged(
          proxyState,
          merged,
          affected,
          compareCache,
          Object.is
        );
        if (touched) {
          const computed = runCompute(merged);
          const withComputed = { ...nextPartial, ...computed };
          set(withComputed, replace as false);
        } else {
          set(nextPartial, replace as false);
        }
      };

      Object.assign(api, {
        setState: setWithComputed,
      });

      const initialState = creator(setWithComputed, get, api);
      const initialComputed = runCompute(initialState);
      return { ...initialState, ...initialComputed };
    };
  };
}
