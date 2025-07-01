import { useCallback, useMemo } from 'react';
import { StoreApi, useStore as useStoreZustand } from 'zustand';
import {
  AnyFunction,
  DeepKeys,
  DeepValue,
  FormState,
  FormRenderProps,
} from './types';
import {
  FormStoreContext,
  getScopedFormApi,
  getWithOptionalPath,
  mergePaths,
  produceStore,
  setWithOptionalPath,
} from './utils';
import { set } from 'lodash-es';

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
    onBlur: () => {
      produceStore(scopedStore, (state) => {
        set(state, ['touched', '_touched'], true);
      });
    },
    onFormChange: useCallback(
      (form) => {
        produceStore(store, (state) => {
          const newForm =
            typeof form === 'function'
              ? (form as AnyFunction)(state.values)
              : form;

          state.values = newForm;
          set(state, ['touched', '_touched'], true);
          set(state, ['dirty', '_dirty'], true);
        });
      },
      [name, scopedStore]
    ),
    onChange: useCallback(
      (value) => {
        produceStore(scopedStore, (state) => {
          const newValue =
            typeof value === 'function'
              ? (value as AnyFunction)(state.values)
              : value;

          state.values = newValue;

          set(state, ['touched', '_touched'], true);
          set(state, ['dirty', '_dirty'], true);
        });
      },
      [name, scopedStore]
    ),
    error,
    touched,
    dirty,
    context,
  });
}
