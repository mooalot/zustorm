import { useCallback, useMemo } from 'react';
import { StoreApi, useStore as useStoreZustand } from 'zustand';
import {
  AnyFunction,
  DeepKeys,
  FormControllerProps,
  FormControllerRenderProps,
  FormState,
} from './types';
import { getScopedFormApi, setWithOptionalPath } from './utils';
import { produce } from 'immer';

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
  S,
  C,
  const K extends DeepKeys<S> | undefined = undefined
>(props: FormControllerProps<S, C, K>): JSX.Element {
  const { store, name, render, contextSelector, options } = props;

  const { useStore = useStoreZustand } = options || {};

  const scopedStore = useMemo(
    () =>
      (name ? getScopedFormApi(store, name) : store) as StoreApi<
        FormState<
          Parameters<
            (typeof props)['render']
          >[0] extends FormControllerRenderProps<infer V>
            ? V
            : never
        >
      >,
    [store, name]
  );

  const value = useStore(scopedStore, (state) => state.values);
  const error = useStore(scopedStore, (state) => state.errors);
  const touched = useStore(scopedStore, (state) => state.touched);
  const dirty = useStore(scopedStore, (state) => state.dirty);
  const context = useStore(store, (state) => {
    if (!contextSelector) return undefined;
    return contextSelector(state.values);
  }) as any;

  return render({
    value: value,
    onBlur: useCallback(() => {
      scopedStore.setState((state) => {
        return produce(state, (draft) => {
          // Mark the field as touched
          return setWithOptionalPath(draft, 'touched._touched', true);
        });
      });
    }, [scopedStore]),
    onFormChange: useCallback(
      (form) => {
        store.setState((state) => {
          return produce(state, (draft) => {
            const newForm =
              typeof form === 'function'
                ? (form as AnyFunction)(draft.values)
                : form;
            return setWithOptionalPath(draft, 'values', newForm);
          });
        });
      },
      [store]
    ),
    onChange: useCallback(
      (value) => {
        scopedStore.setState((state) => {
          return produce(state, (draft) => {
            const newValue =
              typeof value === 'function'
                ? (value as AnyFunction)(draft.values)
                : value;

            return setWithOptionalPath(draft, 'values', newValue);
          });
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
