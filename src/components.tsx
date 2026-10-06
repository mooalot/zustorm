import { DeepKeys, FormControllerProps } from './types';
import { useFormController } from './useFormController';

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
  const K extends DeepKeys<S> | undefined = undefined,
>(props: FormControllerProps<S, C, K>): JSX.Element {
  const { store, name, contextSelector, render, options } = props;
  return render(
    useFormController<S, C, K>(store, name, {
      contextSelector,
      useStore: options?.useStore,
    })
  );
}
