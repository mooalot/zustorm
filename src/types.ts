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
  P extends string | readonly (string | number)[]
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
  P extends string
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

/**
 * The core form state type that represents the complete state of a form.
 * Includes form values, validation errors, touched/dirty states, and submission status.
 */
export type FormState<T> = {
  /**
   * The current values of the form fields.
   */
  values: T;
  /**
   * The errors of the form fields. Currently only supports Zod errors.
   */
  errors?: Errors<T>;
  /**
   * The touched state of the form fields.
   */
  touched?: Touched<T>;
  /**
   * If the form is dirty. This is a boolean value that indicates if the form is dirty or not.
   */
  dirty?: Dirty<T>;
};

/**
 * A utility type that recursively maps over the keys of an object T,
 * adding the properties of object O at each level.
 * Note the outer intersection with O to ensure O's properties are included at the top level as well.
 */
export type Nested<T, O> = T extends null | undefined
  ? Nested<NonNullable<T>, O>
  : (T extends (infer U)[]
      ? Nested<U, O>[]
      : T extends object
      ? { [K in keyof T]?: Nested<T[K], O> }
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

export type FormControllerProps<
  S,
  C,
  K extends DeepKeys<S> | undefined = undefined
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
    useStore?: <S, R>(
      storeApi: StoreApi<FormState<S>>,
      callback: (selector: FormState<S>) => R
    ) => R;
  };
};

export type ExtractForm<T> = T extends FormState<infer S> ? S : never;
