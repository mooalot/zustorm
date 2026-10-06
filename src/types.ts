import { StoreApi } from 'zustand';

export type AnyFunction = (...args: any[]) => any;

// Dot-notation string paths
export type DeepKeyStrings<T> = T extends AnyFunction
  ? never
  : T extends Array<infer U>
    ? `${number}` | `${number}.${DeepKeyStrings<U>}`
    : T extends object
      ? {
          [K in keyof T & (string | number)]: T[K] extends object
            ? `${K}` | `${K}.${DeepKeyStrings<T[K]>}`
            : `${K}`;
        }[keyof T & (string | number)]
      : never;

// Array-based key paths
export type DeepKeyTuples<T> = T extends AnyFunction
  ? never
  : T extends Array<infer U>
    ? [number] | [number, ...DeepKeyTuples<U>]
    : T extends object
      ? {
          [K in keyof T & (string | number)]: T[K] extends object
            ? [K] | [K, ...DeepKeyTuples<T[K]>]
            : [K];
        }[keyof T & (string | number)]
      : never;

// Combined
export type DeepKeys<T> = DeepKeyStrings<T> | DeepKeyTuples<T>;

export type DeepValue<
  T,
  P extends string | readonly (string | number)[],
> = P extends string
  ? DeepValueFromStringPath<T, P>
  : P extends readonly [infer K, ...infer Rest]
    ? K extends keyof T
      ? Rest extends []
        ? T[K]
        : DeepValue<T[K], Extract<Rest, (string | number)[]>>
      : T extends Array<infer U>
        ? K extends number
          ? DeepValue<U, Extract<Rest, (string | number)[]>>
          : never
        : never
    : T;

type DeepValueFromStringPath<
  T,
  P extends string,
> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? DeepValue<T[K], Rest>
    : T extends Array<infer U>
      ? K extends `${number}`
        ? DeepValue<U, Rest>
        : never
      : never
  : P extends keyof T
    ? T[P]
    : T extends Array<infer U>
      ? P extends `${number}`
        ? U
        : never
      : never;

/** Errors type that mirrors the structure of T,
 */
export type Errors<T> = Nested<
  T,
  {
    _errors?: string[];
  }
>;

/** Touched state type that mirrors the structure of T,
 */
export type Touched<T> = Nested<
  T,
  {
    _touched?: boolean;
  }
>;

/**
 * Dirty state type that mirrors the structure of T,
 */
export type Dirty<T> = Nested<
  T,
  {
    _dirty?: boolean;
  }
>;

/** Options for `reset`. */
export type ResetOptions = {
  /**
   * When resetting to supplied values, keep the existing `initialValues`
   * instead of making the supplied values the new baseline.
   */
  keepInitialValues?: boolean;
};

/** The subset of a submit event that `handleSubmit` uses. */
export type SubmitEventLike = { preventDefault?: () => void };

/** The handler returned by `handleSubmit`, suitable for `<form onSubmit>`. */
export type SubmitHandler = (event?: SubmitEventLike) => Promise<void>;

/** Form actions added to the store by `withForm`. */
export type FormActions<T> = {
  /**
   * Reset the form. Without arguments, restores `initialValues` and clears
   * touched, dirty and errors (errors are recomputed from the schema). With
   * values, those become the new `initialValues` unless
   * `options.keepInitialValues` is set.
   */
  reset: (values?: T, options?: ResetOptions) => void;
  /** Clear all touched state. */
  resetTouched: () => void;
  /** Clear all dirty state. */
  resetDirty: () => void;
  /** Clear errors. They stay cleared until the values change or `validate` runs. */
  resetErrors: () => void;
  /** Mark every field as touched, for example to show all errors on submit. */
  touchAll: () => void;
  /** Re-run the schema, write the errors to the store and return validity. */
  validate: () => boolean;
  /**
   * Build a submit handler: prevents the event default, touches every field,
   * validates, then calls `onValid` with the values or `onInvalid` with the errors.
   */
  handleSubmit: (
    onValid: (values: T) => void | Promise<void>,
    onInvalid?: (errors: Errors<T>) => void | Promise<void>
  ) => SubmitHandler;
};

/** Booleans derived from the form state by `withForm`. */
export type FormComputed = {
  /** True if any field is dirty. */
  isDirty: boolean;
  /** True if any field is touched. */
  isTouched: boolean;
  /** True if there are no validation errors. */
  isValid: boolean;
};

/** Data held by a form, before actions and computed flags are attached. */
export type BaseFormState<T> = {
  /**
   * The current values of the form fields.
   */
  values: T;
  /**
   * The baseline `reset()` returns to. Defaults to the initial values and moves
   * when `reset(values)` is called.
   */
  initialValues?: T;
  /**
   * The errors of the form fields, mirroring the structure of the values.
   */
  errors?: Errors<T>;
  /**
   * The touched state of the form fields.
   */
  touched?: Touched<T>;
  /**
   * The dirty state of the form fields.
   */
  dirty?: Dirty<T>;
};

/** Form data plus the computed flags and actions attached by `withForm`. */
export type FormState<T> = BaseFormState<T> & FormComputed & FormActions<T>;

/**
 * A utility type that recursively maps over the keys of an object T,
 * adding the properties of object O at each level.
 * Note the outer intersection with O to ensure O's properties are included at the top level as well.
 */
export type Nested<T, O> = (T extends (infer U)[]
  ? Record<number, Nested<NonNullable<U>, O>>
  : T extends object
    ? { [K in keyof T]?: Nested<NonNullable<T[K]>, O> }
    : O) &
  O;

/**
 * Render props type for the FormController render prop.
 * Provides form state and handlers for building form UIs.
 * Automatically handles value changes, validation, touched/dirty states, and provides
 * optimized change handlers for form interactions.
 *
 * @param Value - The type of the field value.
 * @param FormState - The type of the form state.
 * @param Context - The type of the context object.
 */
export type FormControllerRenderProps<Value, FormState = any, Context = any> = {
  /** Reset the current form scope to its initial values or the supplied values. */
  reset: (values?: Value, options?: ResetOptions) => void;
  /** Clear touched state for the current form scope. */
  resetTouched: () => void;
  /** Clear dirty state for the current form scope. */
  resetDirty: () => void;
  /** Clear errors for the current form scope. */
  resetErrors: () => void;
  /** Mark every field in the current form scope as touched. */
  touchAll: () => void;
  /** Re-run validation and return whether the current form scope is valid. */
  validate: () => boolean;
  /** Build a submit handler for the current form scope. */
  handleSubmit: FormActions<Value>['handleSubmit'];
  /** True if any field in the current form scope is dirty. */
  isDirty: boolean;
  /** True if any field in the current form scope is touched. */
  isTouched: boolean;
  /** True if the current form scope has no validation errors. */
  isValid: boolean;
  /**
   * onFormChange is a function that can be used to update the form state.
   * It can be a value or a function that returns a value.
   */
  onFormChange: (form: FormState | ((form: FormState) => FormState)) => void;
  /**
   * The context object for the field. Evaluated from the contextSelector.
   */
  context: Context;
  /**
   * The value of the field.
   */
  value: Value;
  /**
   * The function to call when the value changes.
   * It can be a value or a function that returns a value.
   */
  onChange: (value: Value | ((value: Value) => Value)) => void;
  /**
   * The function to call when the input is blurred.
   * It can be used to trigger validation or other side effects.
   */
  onBlur?: () => void;
  /**
   * The error object for the field.
   */
  error?: Nested<
    Value,
    {
      _errors?: string[];
    }
  >;
  /**
   * The first error message for the field (or for any field below it), if any.
   */
  errorMessage?: string;
  /**
   * Every error message for the field and the fields below it.
   */
  errorMessages: string[];
  /**
   * The touched state of the field.
   */
  touched?: Nested<
    Value,
    {
      _touched?: boolean;
    }
  >;
  /**
   * If the field is dirty.
   */
  dirty?: Nested<
    Value,
    {
      _dirty?: boolean;
    }
  >;
};

/** Custom store hook, for example `useStoreWithEqualityFn`. */
export type UseStoreHook = <S, R>(
  storeApi: StoreApi<FormState<S>>,
  callback: (selector: FormState<S>) => R
) => R;

/** Options for the `useFormController` hook. */
export type UseFormControllerOptions<S, C> = {
  /** Select extra data from the form values without scoping to it. */
  contextSelector?: (state: S) => C;
  /** Custom store hook to use instead of the default zustand useStore. */
  useStore?: UseStoreHook;
};

export type FormControllerProps<
  S,
  C,
  K extends DeepKeys<S> | undefined = undefined,
> = {
  store: StoreApi<FormState<S>>;
  name?: K;
  contextSelector?: (state: S) => C;
  render: (
    props: FormControllerRenderProps<
      K extends DeepKeys<S> ? DeepValue<S, K> : S,
      S,
      C
    >
  ) => JSX.Element;
  options?: {
    useStore?: UseStoreHook;
  };
};
