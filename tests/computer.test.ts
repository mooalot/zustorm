import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand';
import { createComputer } from '../src/computer';

describe('createComputer', () => {
  describe('basic functionality', () => {
    it('should create a computed store with initial computed values', () => {
      interface State {
        count: number;
        doubled: number;
      }

      const store = createStore<State>()(
        createComputer<State>((state) => ({
          doubled: state.count * 2,
        }))((set) => ({
          count: 5,
          doubled: 0, // Will be computed
        }))
      );

      const state = store.getState();
      expect(state.count).toBe(5);
      expect(state.doubled).toBe(10);
    });

    it('should recompute when properties change', () => {
      interface State {
        count: number;
        multiplier: number;
        result: number;
      }

      const store = createStore<State>()(
        createComputer<State>((state) => ({
          result: state.count * state.multiplier,
        }))((set) => ({
          count: 2,
          multiplier: 3,
          result: 0,
        }))
      );

      expect(store.getState().result).toBe(6);

      // Change count
      store.setState({ count: 4 });
      expect(store.getState().result).toBe(12);

      // Change multiplier
      store.setState({ multiplier: 5 });
      expect(store.getState().result).toBe(20);
    });

    it('should not recompute when state is set to the same values', () => {
      interface State {
        count: number;
        other: string;
        doubled: number;
        computeCallCount: number;
      }

      let computeCallCount = 0;

      const store = createStore<State>()(
        createComputer<State>((state) => {
          computeCallCount++;
          return {
            doubled: state.count * 2,
            computeCallCount,
          };
        })((set) => ({
          count: 5,
          other: 'initial',
          doubled: 0,
          computeCallCount: 0,
        }))
      );

      // Initial computation
      expect(store.getState().computeCallCount).toBe(1);
      expect(store.getState().doubled).toBe(10);

      // Set the same values - should not recompute
      store.setState({ count: 5, other: 'initial' });
      expect(store.getState().computeCallCount).toBe(1);

      // Change values - should recompute
      store.setState({ count: 7 });
      expect(store.getState().computeCallCount).toBe(2);
      expect(store.getState().doubled).toBe(14);
    });

    it('should not recompute when changing non-accessed property', () => {
      interface State {
        count: number;
        other: string;
        doubled: number;
        computeCallCount: number;
      }

      let computeCallCount = 0;

      const store = createStore<State>()(
        createComputer<State>((state) => {
          computeCallCount++;
          return {
            doubled: state.count * 2,
            computeCallCount,
          };
        })((set) => ({
          count: 5,
          other: 'initial',
          doubled: 0,
          computeCallCount: 0,
        }))
      );

      expect(store.getState().computeCallCount).toBe(1);

      // Change non-accessed property
      store.setState({ other: 'changed' });

      // This should not trigger recomputation
      expect(store.getState().computeCallCount).toBe(1);
    });
  });

  describe('state change detection', () => {
    it('should detect changes in nested objects', () => {
      interface State {
        user: {
          profile: {
            name: string;
            age: number;
          };
          settings: {
            theme: string;
          };
        };
        displayName: string;
        computeCallCount: number;
      }

      let computeCallCount = 0;

      const store = createStore<State>()(
        createComputer<State>((state) => {
          computeCallCount++;
          return {
            displayName: `${state.user.profile.name} (${state.user.profile.age})`,
            computeCallCount,
          };
        })((set) => ({
          user: {
            profile: {
              name: 'John',
              age: 30,
            },
            settings: {
              theme: 'dark',
            },
          },
          displayName: '',
          computeCallCount: 0,
        }))
      );

      expect(store.getState().displayName).toBe('John (30)');
      expect(store.getState().computeCallCount).toBe(1);

      // Change nested property
      store.setState((state) => ({
        user: {
          ...state.user,
          profile: {
            ...state.user.profile,
            name: 'Jane',
          },
        },
      }));
      expect(store.getState().computeCallCount).toBe(2);
      expect(store.getState().displayName).toBe('Jane (30)');
    });

    it('should handle array changes', () => {
      interface State {
        items: { id: number; name: string }[];
        count: number;
        computeCallCount: number;
      }

      let computeCallCount = 0;

      const store = createStore<State>()(
        createComputer<State>((state) => {
          computeCallCount++;
          return {
            count: state.items.length,
            computeCallCount,
          };
        })((set) => ({
          items: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' },
          ],
          count: 0,
          computeCallCount: 0,
        }))
      );

      expect(store.getState().count).toBe(2);
      expect(store.getState().computeCallCount).toBe(1);

      // Add item to array
      store.setState((state) => ({
        items: [...state.items, { id: 3, name: 'Item 3' }],
      }));
      expect(store.getState().count).toBe(3);
      expect(store.getState().computeCallCount).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should handle errors in compute function gracefully', () => {
      interface State {
        value: number;
        result: number;
      }

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const store = createStore<State>()(
        createComputer<State>((state) => {
          if (state.value < 0) {
            throw new Error('Negative values not allowed');
          }
          return {
            result: state.value * 2,
          };
        })((set) => ({
          value: 5,
          result: 0,
        }))
      );

      expect(store.getState().result).toBe(10);

      // Set negative value to trigger error
      store.setState({ value: -1 });
      expect(store.getState().result).toBe(10); // Should keep previous value
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in compute function:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle null and undefined values', () => {
      interface State {
        data: { value?: number } | null;
        result: number;
      }

      const store = createStore<State>()(
        createComputer<State>((state) => ({
          result: state.data?.value ?? 0,
        }))((set) => ({
          data: null,
          result: 0,
        }))
      );

      expect(store.getState().result).toBe(0);

      store.setState({ data: { value: 42 } });
      expect(store.getState().result).toBe(42);

      store.setState({ data: null });
      expect(store.getState().result).toBe(0);
    });
  });

  describe('functional updates', () => {
    it('should work with functional state updates', () => {
      interface State {
        count: number;
        doubled: number;
      }

      const store = createStore<State>()(
        createComputer<State>((state) => ({
          doubled: state.count * 2,
        }))((set) => ({
          count: 1,
          doubled: 0,
        }))
      );

      expect(store.getState().doubled).toBe(2);

      store.setState((state) => ({ count: state.count + 1 }));
      expect(store.getState().doubled).toBe(4);

      store.setState((state) => ({ count: state.count * 3 }));
      expect(store.getState().doubled).toBe(12);
    });
  });

  describe('multiple computed properties', () => {
    it('should handle multiple computed properties', () => {
      interface State {
        firstName: string;
        lastName: string;
        age: number;
        fullName: string;
        isAdult: boolean;
        displayInfo: string;
        computeCallCount: number;
      }

      let computeCallCount = 0;

      const store = createStore<State>()(
        createComputer<State>((state) => {
          computeCallCount++;
          return {
            fullName: `${state.firstName} ${state.lastName}`,
            isAdult: state.age >= 18,
            displayInfo: `${state.firstName} ${state.lastName} (${state.age})`,
            computeCallCount,
          };
        })((set) => ({
          firstName: 'John',
          lastName: 'Doe',
          age: 25,
          fullName: '',
          isAdult: false,
          displayInfo: '',
          computeCallCount: 0,
        }))
      );

      const initialState = store.getState();
      expect(initialState.fullName).toBe('John Doe');
      expect(initialState.isAdult).toBe(true);
      expect(initialState.displayInfo).toBe('John Doe (25)');
      expect(initialState.computeCallCount).toBe(1);

      // Change first name
      store.setState({ firstName: 'Jane' });
      const updatedState = store.getState();
      expect(updatedState.fullName).toBe('Jane Doe');
      expect(updatedState.displayInfo).toBe('Jane Doe (25)');
      expect(updatedState.computeCallCount).toBe(2);
    });
  });

  describe('state equality', () => {
    it('should not recompute when setting the same object reference', () => {
      interface State {
        data: { items: number[] };
        sum: number;
        computeCallCount: number;
      }

      let computeCallCount = 0;

      const store = createStore<State>()(
        createComputer<State>((state) => {
          computeCallCount++;
          return {
            sum: state.data.items.reduce((acc, item) => acc + item, 0),
            computeCallCount,
          };
        })((set) => ({
          data: { items: [1, 2, 3] },
          sum: 0,
          computeCallCount: 0,
        }))
      );

      expect(store.getState().sum).toBe(6);
      expect(store.getState().computeCallCount).toBe(1);

      // Set the same object reference
      const currentData = store.getState().data;
      store.setState({ data: currentData });
      expect(store.getState().computeCallCount).toBe(1); // Should not recompute
    });

    it('should not recompute when setting equivalent values', () => {
      interface State {
        data: { items: number[] };
        sum: number;
        computeCallCount: number;
      }

      let computeCallCount = 0;

      const store = createStore<State>()(
        createComputer<State>((state) => {
          computeCallCount++;
          return {
            sum: state.data.items.reduce((acc, item) => acc + item, 0),
            computeCallCount,
          };
        })((set) => ({
          data: { items: [1, 2, 3] },
          sum: 0,
          computeCallCount: 0,
        }))
      );

      expect(store.getState().sum).toBe(6);
      expect(store.getState().computeCallCount).toBe(1);

      // Set equivalent but different object with same serialization
      store.setState({ data: { items: [1, 2, 3] } });
      expect(store.getState().computeCallCount).toBe(1); // Should not recompute due to serialization equality
    });
  });

  describe('performance', () => {
    it('should handle state updates efficiently', () => {
      interface State {
        counters: { [key: string]: number };
        total: number;
        computeCallCount: number;
      }

      let computeCallCount = 0;

      const store = createStore<State>()(
        createComputer<State>((state) => {
          computeCallCount++;
          return {
            total: Object.values(state.counters).reduce(
              (acc, val) => acc + val,
              0
            ),
            computeCallCount,
          };
        })((set) => ({
          counters: { a: 1, b: 2, c: 3 },
          total: 0,
          computeCallCount: 0,
        }))
      );

      expect(store.getState().total).toBe(6);
      expect(store.getState().computeCallCount).toBe(1);

      // Update counter
      store.setState((state) => ({
        counters: { ...state.counters, a: 5 },
      }));
      expect(store.getState().total).toBe(10);
      expect(store.getState().computeCallCount).toBe(2);
    });
  });
});
