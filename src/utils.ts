import { produce, WritableDraft } from 'immer';
import { get, isEqual, set } from 'lodash-es';
import { isChanged } from 'proxy-compare';
import { createContext, useCallback, useContext } from 'react';
import { object, ZodFormattedError, ZodType } from 'zod';
import {
  createStore,
  StateCreator,
  StoreApi,
  StoreMutatorIdentifier,
  useStore as useStoreZustand,
} from 'zustand';
import { AnyFunction, DeepKeys, DeepValue, FormState } from './types';

type Computed = <T extends object, K extends keyof T>(
  computed: Compute<T, Pick<T, K>>
) => <
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  creator: StateCreator<T, [...Mps], Mcs>
) => StateCreator<T, Mps, [...Mcs]>;

type Compute<T, A> = (state: T) => A;

function produceStore<T>(
  useStore: { setState: StoreApi<T>['setState'] },
  producer: (draft: WritableDraft<T>) => void
) {
  useStore.setState((state) => produce(state, producer));
}

const createComputer = createComputerImplementation as unknown as Computed;
function createComputerImplementation<T extends object, K extends keyof T>(
  compute: Compute<T, Pick<T, K>>
): (creator: StateCreator<T>) => StateCreator<T> {
  return (creator) => {
    return (set, get, api) => {
      const affected = new WeakMap();

      const isTrackedEqual = (next: T, prev: T) =>
        !isChanged(
          prev,
          next,
          affected,
          new WeakMap(),
          isEqual as (a: unknown, b: unknown) => boolean
        );

      const computeAndMerge = (state: T) =>
        Object.assign({}, state, compute(state));

      type SetState = StoreApi<T>['setState'];
      const setWithComputed = (set: SetState): SetState => {
        return (state) => {
          const prevState = get();
          const nextPartialState =
            typeof state === 'function' ? state(prevState) : state;
          const newState = { ...prevState, ...nextPartialState };

          if (!isTrackedEqual(newState, prevState))
            set(computeAndMerge(newState));
          else set(newState);
        };
      };

      api.setState = setWithComputed(api.setState);

      return computeAndMerge(creator(setWithComputed(set), get, api));
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

export type FormController<T> = {
  <K extends DeepKeys<T> | undefined = undefined, C = undefined>(props: {
    /**
     * The name of the field. This is used to identify the field in the form state.
     * It can be a string or an array of strings.
     */
    name?: K;
    /**
     * The context selector function. This function is used to select the context for the field.
     */
    contextSelector?: (state: T) => C;
    /**
     * The functional component that renders the field.
     */
    render: (
      props: FormRenderProps<
        K extends DeepKeys<T> ? DeepValue<T, K> : T,
        C extends undefined ? undefined : C,
        T
      >
    ) => JSX.Element;
  }): JSX.Element;
};

export function createFormController<
  S,
  K extends DeepKeys<S> | undefined = undefined,
  V = K extends DeepKeys<S> ? DeepValue<S, K> : S,
  U = V extends FormState<infer X> ? X : never,
  EN extends DeepKeys<U> | undefined = undefined
>(
  /**
   * Store can be either store api or a bound store.
   * If its a bound store, it will use that as its default selector.
   * If its a store api, it will default to zustand's default selector.
   * Either of these options can be overriden when passing useStore into options.
   */
  store: StoreApi<S> | (StoreApi<S> & (<U>(selector: (state: S) => U) => U)),
  options?: {
    /**
     * The path to the form in the store. Note: this will override whatever formpath in the store provider if used.
     */
    formPath?: K;
    /**
     * The name (path) of the variable to edit. Note, this builds on top of the path in the store provider if used.
     */
    name?: EN;
    /**
     * The function to use the store (e.g. useStore, useStoreWithEqualityFn, etc).
     */
    useStore?: (storeApi: StoreApi<S>, callback: (selector: S) => any) => any;
  }
): FormController<EN extends DeepKeys<U> ? DeepValue<U, EN> : U> {
  const {
    formPath: initialFormPath = '',
    name: initialName = '',
    useStore: useMethod = useStoreZustand,
  } = options || {};

  return (props) => {
    const useStore = useCallback(<T>(callback: (selector: S) => T) => {
      if (typeof store === 'function' && !options?.useStore) {
        return store(callback);
      } else {
        return useMethod(store, callback);
      }
    }, []);
    const { name: contextName = '', formPath: contextFormPath = '' } =
      useContext(PathContext) as PathContext<S, K>;
    const formPath = initialFormPath || contextFormPath;
    const { name = '', render, contextSelector } = props;
    type Value = Parameters<typeof render>[0]['value'];

    const getResolvePath = useCallback((state: any, ...segments: any[]) => {
      return [...segments]
        .filter(Boolean)
        .reduce((obj, segment) => safeGet(obj, segment), state);
    }, []);

    const setResolvePath = useCallback(
      (state: any, value: any, ...segments: any[]) => {
        const filteredSegments = segments.filter(Boolean);
        const lastSegment = filteredSegments.pop();
        const target = filteredSegments.reduce((obj, segment) => {
          const current = safeGet(obj, segment);
          if (current === undefined) {
            return safeSet(obj, segment, {});
          }
          return current;
        }, state);
        if (lastSegment) {
          safeSet(target, lastSegment, value);
        }
        return state;
      },
      []
    );

    const getForm = useCallback(
      (state: S): FormState<U> => {
        return formPath
          ? (safeGet(state, formPath) as FormState<U>)
          : (state as unknown as FormState<U>);
      },
      [formPath]
    );

    const value = useStore((state) => {
      return getResolvePath(
        state,
        formPath,
        'values',
        contextName,
        initialName,
        name
      ) as Value;
    });
    const error = useStore((state) => {
      return getResolvePath(
        state,
        formPath,
        'errors',
        contextName,
        initialName,
        name
      ) as ZodFormattedError<Value>;
    });
    const context = useStore((state) => {
      if (!contextSelector) return undefined;
      const values = getResolvePath(state, formPath, 'values', contextName);
      if (!values) return undefined;
      return contextSelector(values);
    });

    return render({
      value,
      onBlur: () => {
        produceStore(store, (state) => {
          const formState = getForm(state as S);
          formState.isTouched = true;
        });
      },
      onChange: useCallback(
        (value, form) => {
          produceStore(store, (state) => {
            const formState = getForm(state as S);
            if (!formState.values) return;

            const newValue =
              typeof value === 'function'
                ? (value as AnyFunction)(
                    getResolvePath(
                      state,
                      'values',
                      contextName,
                      initialName,
                      name
                    )
                  )
                : value;

            setResolvePath(
              formState,
              newValue,
              'values',
              contextName,
              initialName,
              name
            );

            if (form) {
              const newValues =
                typeof form === 'function'
                  ? (form as AnyFunction)(formState.values)
                  : form;
              formState.values = newValues;
            }

            formState.isDirty = true;
            formState.isTouched = true;
          });
        },
        [contextName, name, getForm, setResolvePath, getResolvePath]
      ),
      error,
      context: context as any,
    });
  };
}

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
    isValidCallback?: (
      form: F extends FormState<infer F> ? F : never
    ) => boolean;
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
    isValidCallback?: (
      form: F extends FormState<infer F> ? F : never
    ) => boolean;
  }) {
    const { formPath, getSchema, isValidCallback } = options || {};
    return createComputer<S, keyof S>((state) => {
      const schema = getSchema?.(state);
      return produce(state, (draft) => {
        const form = safeGet(draft, formPath ?? '') as FormState<any>;
        if (!form) return;

        const errors = (schema ?? object({})).safeParse(form.values);
        const errorsFormatted = errors.error?.format();

        safeSet(draft, formPath, {
          ...form,
          isValid: isValidCallback
            ? isValidCallback(form as F extends FormState<infer F> ? F : never)
            : errors.success,
          errors: errorsFormatted,
        });
      });
    });
  };
}

export function getDefaultForm<T extends object>(values: T): FormState<T> {
  return {
    isValid: true,
    isDirty: false,
    isTouched: false,
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

export const FormStoreContext = createContext<StoreApi<any> | undefined>(
  undefined
);

export type PathContext<S, K> = {
  formPath?: S;
  name?: K;
};

export const PathContext = createContext<PathContext<any, any>>({});

// there should either be more options on a form provider or a new componnt that allows you to change the context of the children,
//similar to how creating a form controller works, such as providing an initial name

export function useFormStoreContext<S>() {
  const store = useContext(FormStoreContext) as StoreApi<FormState<S>>;
  if (!store) {
    throw new Error(
      'useFormStoreContext must be used within FormStoreProvider'
    );
  }
  return store;
}
