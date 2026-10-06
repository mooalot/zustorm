import { createContext, useContext, useMemo } from 'react';
import { StoreApi } from 'zustand';
import { getScopedFormApi } from './scoped';
import { DeepKeys, FormState } from './types';

/**
 * Creates a React context provider for a form store.
 * This allows child components to access the form store using the useFormStore hook.
 *
 * @returns A tuple containing the FormStoreProvider component and the useFormStore hook
 */
export function createFormStoreProvider<S>() {
  const FormStoreContext = createContext<StoreApi<FormState<any>> | null>(null);

  /**
   * React context provider component that makes a form store available to child components.
   *
   * @param children - React children components
   * @param store - The form store to provide to child components
   * @param options.name - Path to a specific part of the form to scope the provider to
   */
  function FormStoreProvider<
    T = S,
    const K extends DeepKeys<T> | undefined = undefined,
  >({
    children,
    store,
    options,
  }: {
    children?: React.ReactNode;
    store: StoreApi<FormState<T>>;
    options?: {
      /** Provide the name (path) to the variable in the form */
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
   * React hook to access the form store from context.
   * Must be used within a FormStoreProvider component.
   */
  function useFormStore<State = S>() {
    const store = useContext(FormStoreContext) as StoreApi<
      FormState<State>
    > | null;
    if (!store) {
      throw new Error('useFormStore must be used within FormStoreProvider');
    }
    return store;
  }

  return [FormStoreProvider, useFormStore] as const;
}
