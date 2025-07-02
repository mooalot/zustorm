import { useCallback, useMemo } from 'react';
import { StoreApi, useStore as useStoreZustand } from 'zustand';
import {
  AnyFunction,
  DeepKeys,
  DeepValue,
  FormRenderProps,
  FormState,
} from './types';
import {
  FormStoreContext,
  getScopedFormApi,
  getWithOptionalPath,
  produceStore,
  setWithOptionalPath,
} from './utils';

/**
 * React context provider component that makes a form store available to child components.
 * Allows child components to access the form store using useFormStore hook.
 *
 * @param children - React children components
 * @param store - The form store to provide to child components
 * @param options - Optional configuration object
 * @param options.name - Path to a specific part of the form to scope the provider to
 */
export function FormStoreProvider<
  T extends object,
  K extends DeepKeys<T> | undefined = undefined
>({
  children,
  store,
  options,
}: {
  children?: React.ReactNode;
  store: StoreApi<FormState<T>>;
  options?: {
    /**
     * Provide the name (path) to the variable in the form
     */
    name?: K;
  };
}) {
  const { name } = options || {};
  const scopedStore = useMemo(
    () => (name ? getScopedFormApi(store, name) : store),
    [store, name]
  );

  return (
    <FormStoreContext.Provider value={scopedStore}>
      {children}
    </FormStoreContext.Provider>
  );
}

/**
 * A render prop component that provides form state and handlers for building form UIs.
 * Automatically handles value changes, validation, touched/dirty states, and provides
 * optimized change handlers for form interactions.
 *
 * @param store - The form store instance
 * @param name - Optional path to a specific field within the form
 * @param contextSelector - Function to select additional context from the store state
 * @param render - Render function that receives form state and handlers
 * @param options - Optional configuration object
 * @param options.useStore - Custom store hook to use instead of the default zustand useStore
 * @returns JSX element from the render prop
 */
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
      storeApi: StoreApi<FormState<any>>,
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

  const value = useStore(scopedStore, (state) => state.values);
  const error = useStore(scopedStore, (state) => state.errors);
  const touched = useStore(scopedStore, (state) => state.touched);
  const dirty = useStore(scopedStore, (state) => state.dirty);
  const context = useStore(store, (state) => {
    if (!contextSelector) return undefined;
    const values = getWithOptionalPath(state.values, name as string);
    if (!values) return undefined;
    return contextSelector(values);
  }) as C;

  return render({
    value: value,
    onBlur: useCallback(() => {
      produceStore(scopedStore, (state) => {
        setWithOptionalPath(state, 'touched._touched', true);
      });
    }, [scopedStore]),
    onFormChange: useCallback(
      (form) => {
        produceStore(store, (state) => {
          const newForm =
            typeof form === 'function'
              ? (form as AnyFunction)(state.values)
              : form;

          state.values = newForm;
        });
      },
      [store]
    ),
    onChange: useCallback(
      (value) => {
        produceStore(scopedStore, (state) => {
          const newValue =
            typeof value === 'function'
              ? (value as AnyFunction)(state.values)
              : value;

          state.values = newValue;
        });
      },
      [scopedStore]
    ),
    error,
    touched,
    dirty,
    context,
  });
}
