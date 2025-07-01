import { produce, WritableDraft } from 'immer';
import { get, isEqual, set, toPath } from 'lodash-es';
import { createContext, useContext } from 'react';
import { object, ZodType } from 'zod';
import {
  createStore,
  StateCreator,
  StoreApi,
  StoreMutatorIdentifier,
} from 'zustand';
import { AnyFunction, DeepKeys, DeepValue, FormState } from './types';
import { createComputer } from './computer';

export function produceStore<T>(
  useStore: { setState: StoreApi<T>['setState'] },
  producer: (draft: WritableDraft<T>) => void
) {
  useStore.setState((state) => produce(state, producer));
}

/**
 * A higher-order function that enhances a Zustand store creator with form management capabilities.
 * Automatically adds form validation, error handling, and state computation to your store.
 *
 * @param creator - The Zustand store creator function
 * @param options - Configuration options including formPath and schema validation
 * @param options.formPath - The path to the form within the store (required when store state is not directly a FormState)
 * @param options.getSchema - Function to get the Zod schema for form validation
 * @returns An enhanced store creator with form management
 */
export const withForm = <
  S extends object,
  K extends DeepKeys<S> | undefined = undefined,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  creator: StateCreator<S, [...Mps], Mcs>,
  options: S extends FormState<any>
    ? {
        /**
         * The path to the form in the store (optional when S is directly a FormState)
         */
        formPath?: K;
        /**
         * The function to get the schema for the form. This is useful for custom validation logic.
         * It can be a function that returns a Zod schema or a Zod schema itself.
         */
        getSchema?: (
          state: S
        ) => ZodType<S extends FormState<infer U> ? U : never>;
      }
    : K extends undefined
    ? never // Force an error when S is not FormState and no formPath is provided
    : K extends DeepKeys<S>
    ? {
        /**
         * The path to the form in the store (required when S is not directly a FormState)
         */
        formPath: K;
        /**
         * The function to get the schema for the form. This is useful for custom validation logic.
         * It can be a function that returns a Zod schema or a Zod schema itself.
         */
        getSchema?: (
          state: S
        ) => ZodType<DeepValue<S, K> extends FormState<infer U> ? U : never>;
      }
    : never
): StateCreator<S, Mps, [...Mcs]> => {
  return createFormComputer<S>()(options as any)(creator);
};

function createFormComputer<S extends object>() {
  return function <
    K extends DeepKeys<S> | undefined,
    F extends K extends DeepKeys<S>
      ? DeepValue<S, K>
      : S = K extends DeepKeys<S> ? DeepValue<S, K> : S
  >(options?: {
    getSchema?: (
      state: S
    ) => ZodType<F extends FormState<infer U> ? U : never> | undefined;
    formPath?: K;
  }) {
    const { formPath, getSchema } = options || {};
    return createComputer<S>((state) => {
      const schema = getSchema?.(state);
      return produce(state, (draft) => {
        const form = getWithOptionalPath(
          draft,
          formPath as string
        ) as FormState<any>;
        if (!form) return;

        const errors = (schema ?? object({})).safeParse(form.values);
        const errorsFormatted = errors.error?.format();

        setWithOptionalPath(draft, formPath as string, {
          ...form,
          errors: errorsFormatted,
        });
      });
    });
  };
}

/**
 * Creates a default form state object with the provided initial values.
 * Sets up the basic structure with: false and the provided values.
 *
 * @param values - The initial values for the form
 * @returns A FormState object with default properties
 */
export function getDefaultForm<T extends object>(values: T): FormState<T> {
  return {
    values,
  };
}

/**
 * Creates a Zustand store with form state management capabilities.
 * The store will automatically handle form validation, dirty/touched states, and submission states.
 *
 * @param initialValue - The initial values for the form
 * @param options - Optional configuration including schema validation
 * @param options.getSchema - Function to get the Zod schema for form validation
 * @returns A Zustand store configured for form management
 */
export const createFormStore = <T extends object>(
  initialValue: T,
  options?: {
    /**
     * The function to get the schema for the form. This is useful for custom validation logic.
     * It can be a function that returns a Zod schema or a Zod schema itself.
     */
    getSchema?: (state: FormState<T>) => ZodType<T>;
  }
) => {
  return createStore<FormState<T>>()(
    withForm(() => getDefaultForm(initialValue), {
      getSchema: options?.getSchema,
    })
  );
};

export const FormStoreContext = createContext<StoreApi<FormState<any>> | null>(
  null
);

/**
 * React hook to access the form store from context.
 * Must be used within a FormStoreProvider component.
 *
 * @throws Error if used outside of FormStoreProvider
 * @returns The form store instance from context
 */
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

/**
 * Gets a scoped API for accessing a specific form within a larger store state.
 * Useful when you have multiple forms or nested form structures in your store.
 *
 * @param store - The Zustand store instance
 * @param formPath - The path to the specific form within the store
 * @returns A scoped store API for the specified form
 */
export function getFormApi<
  S extends object,
  K extends DeepKeys<S>,
  V = K extends DeepKeys<S> ? DeepValue<S, K> : S
>(store: StoreApi<S>, formPath: K): StoreApi<V> {
  return getScopedApi(store, formPath) as StoreApi<V>;
}

export function mergePaths(
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

export function getWithOptionalPath(state: object, path: string | undefined) {
  if (!path) return state;
  return get(state, path);
}

export function setWithOptionalPath(
  state: object,
  path: string | undefined,
  value: any
) {
  if (!path) return Object.assign(state, value);
  return set(state, path, value);
}
