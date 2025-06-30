import { useMemo } from 'react';
import { StoreApi } from 'zustand';
import { DeepKeys, FormState } from './types';
import { FormStoreContext, getScopedFormApi } from './utils';

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
    () => (name ? getScopedFormApi(store, name as any) : store),
    [store, name]
  );

  console.log('FormStoreProvider', scopedStore.getState(), name);
  return (
    <FormStoreContext.Provider value={scopedStore}>
      {children}
    </FormStoreContext.Provider>
  );
}
