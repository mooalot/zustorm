import { produce, WritableDraft } from 'immer';
import { get, isEqual, set, toPath } from 'lodash-es';
import {
  createProxy,
  getUntracked,
  isChanged,
  markToTrack,
} from 'proxy-compare';
import { createContext, useCallback, useContext, useMemo } from 'react';
import { object, ZodFormattedError, ZodType } from 'zod';
import {
  createStore,
  StateCreator,
  StoreApi,
  StoreMutatorIdentifier,
  useStore as useStoreZustand,
} from 'zustand';
import { AnyFunction, DeepKeys, DeepValue, FormState } from './types';

function produceStore<T>(
  useStore: { setState: StoreApi<T>['setState'] },
  producer: (draft: WritableDraft<T>) => void
) {
  useStore.setState((state) => produce(state, producer));
}

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

const createComputer = createComputerImplementation as unknown as Computed;

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

function safeGet(obj: any, path: any, defaultValue?: any) {
  if (!path || (Array.isArray(path) && path.length === 0)) {
    return obj;
  }
  return get(obj, path, defaultValue);
}

function safeSet(obj: any, path: any, value: any) {
  if (!path || (Array.isArray(path) && path.length === 0)) {
    return Object.assign(obj, value);
  }
  return set(obj, path, value);
}

export type FormRenderProps<T, A, F> = {
  /**
   * The value of the field. This is the value that is stored in the form state.
   */
  value: T;
  /**
   * The function to call when the value changes.
   * It can be a value or a function that returns a value.
   */
  onChange: (value: T | ((value: T) => T), form?: F | ((form: F) => F)) => void;
  /**
   * The function to call when the input is blurred.
   * It can be used to trigger validation or other side effects.
   */
  onBlur?: () => void;
  /**
   * The error object for the field.
   */
  error?: ZodFormattedError<T>;
  /**
   * The context object for the field. Evaluated from the contextSelector.
   */
  context: A;
};

export const withForm = <
  S extends object,
  K extends DeepKeys<S> | undefined,
  //  eslint-disable-next-line @typescript-eslint/no-unused-vars
  F extends K extends DeepKeys<S> ? DeepValue<S, K> : S = K extends DeepKeys<S>
    ? DeepValue<S, K>
    : S,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  creator: StateCreator<S, [...Mps], Mcs>,
  options?: {
    /**
     * The path to the form in the store. Note: this will override whatever formpath in the store provider if used.
     */
    formPath?: K;
    /**
     * The function to get the schema for the form. This is useful for custom validation logic.
     * It can be a function that returns a Zod schema or a Zod schema itself.
     */
    getSchema?: (state: S) => ZodType<F extends FormState<infer F> ? F : never>;
    /**
     * A function that returns a boolean indicating if the form is valid.
     * This is useful for custom validation logic. Defaults to invalid if the schema is not valid.
     */
    isValidCallback?: (form: F) => boolean;
  }
): StateCreator<S, Mps, [...Mcs]> => {
  return createFormComputer<S>()(options)(creator);
};

export function createFormComputer<S extends object>() {
  return function <
    K extends DeepKeys<S> | undefined,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    F extends K extends DeepKeys<S>
      ? DeepValue<S, K>
      : S = K extends DeepKeys<S> ? DeepValue<S, K> : S
  >(options?: {
    /**
     * The function to get the schema for the form. This is useful for custom validation logic.
     * It can be a function that returns a Zod schema or a Zod schema itself.
     */
    getSchema?: (
      state: S
    ) => ZodType<F extends FormState<infer F> ? F : never> | undefined;
    /**
     * The path to the form in the store. Note: this will override whatever formpath in the store provider if used.
     */
    formPath?: K;
    /**
     * A function that returns a boolean indicating if the form is valid.
     * This is useful for custom validation logic. Defaults to invalid if the schema is not valid.
     */
    isValidCallback?: (form: F) => boolean;
  }) {
    const { formPath, getSchema, isValidCallback } = options || {};
    return createComputer<S>((state) => {
      const schema = getSchema?.(state);
      return produce(state, (draft) => {
        const form = safeGet(draft, formPath ?? '') as FormState<any>;
        if (!form) return;

        const errors = (schema ?? object({})).safeParse(form.values);
        const errorsFormatted = errors.error?.format();

        safeSet(draft, formPath, {
          ...form,
          isValid: isValidCallback
            ? isValidCallback(form as F)
            : errors.success,
          errors: errorsFormatted,
        });
      });
    });
  };
}

export function getDefaultForm<T extends object>(values: T): FormState<T> {
  return {
    isSubmitting: false,
    values,
  };
}

export const createFormStore = <T extends object>(
  initialValue: T,
  options?: {
    /**
     * The function to get the schema for the form. This is useful for custom validation logic.
     * It can be a function that returns a Zod schema or a Zod schema itself.
     */
    getSchema?: (state: FormState<T>) => ZodType<T>;
    /**
     * A function that returns a boolean indicating if the form is valid.
     * This is useful for custom validation logic. Defaults to invalid if the schema is not valid.
     */
    isValidCallback?: (form: FormState<T>) => boolean;
  }
) => {
  const formComputer = createFormComputer<FormState<T>>()(options as any);

  return createStore<FormState<T>>()(
    formComputer(() => getDefaultForm(initialValue))
  );
};

export const FormStoreContext = createContext<StoreApi<FormState<any>> | null>(
  null
);

export function useFormStore<S>() {
  const store = useContext(FormStoreContext) as StoreApi<FormState<S>> | null;
  if (!store) {
    throw new Error('useFormStore must be used within FormStoreProvider');
  }
  return store;
}

export function getScopedApi<
  S extends object,
  K extends DeepKeys<S>,
  V = DeepValue<S, K>
>(store: StoreApi<S>, path: K): StoreApi<V> {
  type Store = StoreApi<V>;
  type GetInitialState = Store['getInitialState'];
  type GetState = Store['getState'];
  type SetState = Store['setState'];
  type Subscribe = Store['subscribe'];

  const getInitialState: GetInitialState = () => {
    const state = store.getInitialState();
    return get(state, path) as V;
  };

  const getState: GetState = () => {
    const state = store.getState();
    return get(state, path) as V;
  };

  const setState: SetState = (partial, replace) => {
    const state = store.getState();
    const newState = (
      typeof partial === 'function'
        ? (partial as AnyFunction)(get(state, path) as V)
        : partial
    ) as V;
    const updatedState = set(state, path, newState);
    store.setState(updatedState, replace as true);
  };

  const subscribe: Subscribe = (listener) => {
    return store.subscribe((state, prevState) => {
      const scopedState = get(state, path) as V;
      const scopedPrevState = get(prevState, path) as V;
      if (!isEqual(scopedState, scopedPrevState)) {
        listener(scopedState, scopedPrevState);
      }
    });
  };

  return {
    getInitialState,
    getState,
    setState,
    subscribe,
  };
}

export function getScopedFormState<
  S extends object,
  K extends DeepKeys<S>,
  V = DeepValue<S, K>
>(state: FormState<S>, path: K): FormState<V> {
  const scopedState = get(state.values, path) as FormState<V>['values'];
  const scopedErrors = get(state.errors, path) as FormState<V>['errors'];
  const scopedDirty = get(state.dirty, path) as FormState<V>['dirty'];
  const scopedTouched = get(state.touched, path) as FormState<V>['touched'];
  return {
    values: scopedState,
    errors: scopedErrors,
    dirty: scopedDirty,
    touched: scopedTouched,
    isSubmitting: state.isSubmitting,
  };
}

export function getScopedFormApi<
  S extends object,
  K extends DeepKeys<S>,
  V = DeepValue<S, K>
>(store: StoreApi<FormState<S>>, path: K): StoreApi<FormState<V>> {
  type Store = StoreApi<FormState<V>>;
  type GetInitialState = Store['getInitialState'];
  type GetState = Store['getState'];
  type SetState = Store['setState'];
  type Subscribe = Store['subscribe'];

  const getInitialState: GetInitialState = () => {
    const state = store.getInitialState();
    return getScopedFormState(state, path);
  };

  const getState: GetState = () => {
    const state = store.getState();
    return getScopedFormState(state, path);
  };

  const setState: SetState = (partial, replace) => {
    const state = store.getState();
    const newState =
      typeof partial === 'function'
        ? (partial as AnyFunction)(
            getScopedFormState(state, path) as FormState<S>
          )
        : (partial as FormState<V>);

    const updatedState = produce(state, (draft) => {
      setWithOptionalPath(draft, mergePaths('values', path), newState.values);
      setWithOptionalPath(draft, mergePaths('errors', path), newState.errors);
      setWithOptionalPath(draft, mergePaths('dirty', path), newState.dirty);
      setWithOptionalPath(draft, mergePaths('touched', path), newState.touched);
      draft.isSubmitting = newState.isSubmitting;
    });
    store.setState(updatedState, replace as true);
  };

  const subscribe: Subscribe = (listener) => {
    return store.subscribe((state, prevState) => {
      const scopedState = getScopedFormState(state, path) as FormState<V>;
      const scopedPrevState = getScopedFormState(
        prevState,
        path
      ) as FormState<V>;
      if (!isEqual(scopedState.values, scopedPrevState.values)) {
        listener(scopedState, scopedPrevState);
      }
    });
  };

  return {
    getInitialState,
    getState,
    setState,
    subscribe,
  };
}

export function getFormApi<
  S extends object,
  K extends DeepKeys<S>,
  V = K extends DeepKeys<S> ? DeepValue<S, K> : S,
  F = V extends FormState<infer X> ? X : never
>(store: StoreApi<S>, formPath: K = '' as K): StoreApi<F> {
  return getScopedApi(store, formPath) as StoreApi<F>;
}

function mergePaths(
  ...paths: (DeepKeys<any> | undefined)[]
): string | undefined {
  const nonNullPaths = paths.filter((p) => p !== undefined);
  if (nonNullPaths.length === 0) return undefined;
  const mergedPath = nonNullPaths.reduce((acc, path) => {
    if (!path) return acc;
    const pathString = toPath(path).join('.');
    return acc ? `${acc}.${pathString}` : pathString;
  }, '');
  return toPath(mergedPath).join('.') as string;
}

function getWithOptionalPath(state: object, path: string | undefined) {
  if (!path) return state;
  return get(state, path);
}

function setWithOptionalPath(
  state: object,
  path: string | undefined,
  value: any
) {
  if (!path) return Object.assign(state, value);
  return set(state, path, value);
}

export function FormController<
  S extends object,
  C,
  K extends DeepKeys<S> | undefined = undefined,
  V = K extends DeepKeys<S> ? DeepValue<S, K> : S
>(props: {
  store: StoreApi<FormState<S>>;
  name?: K;
  contextSelector?: (state: S) => C;
  render: (props: FormRenderProps<V, C, S>) => JSX.Element;
  options?: {
    useStore?: (
      storeApi: StoreApi<FormState<S>>,
      callback: (selector: FormState<S>) => any
    ) => any;
  };
}): JSX.Element {
  const { store, name, render, contextSelector, options } = props;

  const { useStore = useStoreZustand } = options || {};

  const scopedStore = useMemo(
    () =>
      (name ? getScopedFormApi(store, name) : store) as StoreApi<FormState<V>>,
    [store, name]
  );

  const value = useStore(store, (state) =>
    getWithOptionalPath(state.values, mergePaths(name))
  );
  const error = useStore(store, (state) =>
    getWithOptionalPath(state, mergePaths('errors', name))
  );
  const context = useStore(store, (state) => {
    if (!contextSelector) return undefined;
    const values = getWithOptionalPath(state.values, mergePaths(name));
    if (!values) return undefined;
    return contextSelector(values);
  });

  return render({
    value: value,
    onBlur: () => {
      produceStore(scopedStore, (state) => {
        setWithOptionalPath(
          state,
          mergePaths('touched', name, '_touched'),
          true
        );
      });
    },
    onChange: useCallback(
      (value, form) => {
        produceStore(scopedStore, (state) => {
          if (!state.values) return;

          const newValue =
            typeof value === 'function'
              ? (value as AnyFunction)(
                  getWithOptionalPath(state.values, name as any)
                )
              : value;

          setWithOptionalPath(state.values, mergePaths(name), newValue);

          if (form) {
            const newValues =
              typeof form === 'function'
                ? (form as AnyFunction)(state.values)
                : form;
            state.values = newValues;
          }

          setWithOptionalPath(
            state,
            mergePaths('touched', name, '_touched'),
            true
          );
          setWithOptionalPath(state, mergePaths('dirty', name, '_dirty'), true);
        });
      },
      [name, scopedStore]
    ),
    error: error,
    context: context as any,
  });
}
