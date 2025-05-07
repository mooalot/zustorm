import { StoreApi } from 'zustand';
import { DeepKeys, DeepValue, FormState } from './types';
import { useMemo } from 'react';
import { FormStoreContext, PathContext } from './utils';

export const FormStoreProvider = <
  T,
  K extends DeepKeys<T> | undefined = undefined,
  V = K extends DeepKeys<T> ? DeepValue<T, K> : T,
  U = V extends FormState<infer X> ? X : never,
  EN extends DeepKeys<U> | undefined = undefined
>({
  children,
  store,
  options,
}: {
  children: React.ReactNode;
  store: StoreApi<T>;
  options?: {
    /**
     * Provide the path to the form in the store
     */
    formPath?: K;
    /**
     * Provide the name (path) to the variable in the form
     */
    name?: EN;
  };
}) => {
  const { name: initialName, formPath } = options || {};
  const pathContext = useMemo(
    () => ({
      formPath: formPath ?? '',
      name: initialName ?? '',
    }),
    [formPath, initialName]
  );
  return (
    <PathContext.Provider value={pathContext}>
      <FormStoreContext.Provider value={store}>
        {children}
      </FormStoreContext.Provider>
    </PathContext.Provider>
  );
};
