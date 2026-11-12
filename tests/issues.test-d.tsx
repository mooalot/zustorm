/**
 * Type-level regressions for reported GitHub issues.
 */
import { describe, expectTypeOf, it } from 'vitest';
import { StoreApi } from 'zustand';
import {
  DeepKeys,
  DeepValue,
  FormController,
  FormControllerRenderProps,
  FormState,
  getScopedFormApi,
  setError,
  useFormController,
} from '../src';

describe('#9 useFormController resolves inside generic wrappers', () => {
  it('a generic field hook needs no cast', () => {
    function useFieldValue<T, K extends DeepKeys<T>>(
      store: StoreApi<FormState<T>>,
      name: K
    ): DeepValue<T, K> {
      return useFormController(store, name).value;
    }
    function useField<T, K extends DeepKeys<T>>(
      store: StoreApi<FormState<T>>,
      name: K
    ): FormControllerRenderProps<DeepValue<T, K>, T> {
      return useFormController(store, name);
    }
    function useForm<T>(store: StoreApi<FormState<T>>): T {
      return useFormController(store).value;
    }
    expectTypeOf(useFieldValue).toBeFunction();
    expectTypeOf(useField).toBeFunction();
    expectTypeOf(useForm).toBeFunction();
  });

  it('concrete call sites infer as before', () => {
    type F = { user: { name: string; age: number } };
    const store = {} as StoreApi<FormState<F>>;
    expectTypeOf(useFormController(store).value).toEqualTypeOf<F>();
    expectTypeOf(
      useFormController(store, 'user.age').value
    ).toEqualTypeOf<number>();
    expectTypeOf(
      useFormController(store, ['user', 'name']).value
    ).toEqualTypeOf<string>();
    expectTypeOf(
      useFormController(store, 'user', {
        contextSelector: (v) => v.user.age,
      }).context
    ).toEqualTypeOf<number>();
    // @ts-expect-error not a path of F
    useFormController(store, 'user.nope');
  });
});

describe('#10 DeepKeys descends into union fields', () => {
  type Json =
    string | number | boolean | null | Json[] | { [key: string]: Json };
  type Form = { meta: string | { owner: string }; data: Record<string, Json> };

  it('accepts nested paths through leaf | object unions', () => {
    const a: DeepKeys<Form> = 'meta.owner';
    const b: DeepKeys<Form> = ['meta', 'owner'];
    expectTypeOf<DeepValue<Form, 'meta.owner'>>().toEqualTypeOf<string>();
    expectTypeOf<DeepValue<Form, ['meta', 'owner']>>().toEqualTypeOf<string>();
    // @ts-expect-error still rejects unknown keys
    const c: DeepKeys<Form> = 'meta.nope';
    void [a, b, c];
  });

  it('accepts paths into recursive JSON values', () => {
    const store = {} as StoreApi<FormState<Form>>;
    setError(store, ['data', 'items', 0, 'name'], 'Required');
    setError(store, 'data.items.0.name', 'Required');
    getScopedFormApi(store, 'data.config');
  });
});

describe('#9 FormController resolves inside generic wrappers', () => {
  it('a generic field component needs no cast', () => {
    function Field<T, K extends DeepKeys<T>>(props: {
      store: StoreApi<FormState<T>>;
      name: K;
      show: (value: DeepValue<T, K>) => string;
    }) {
      return (
        <FormController
          store={props.store}
          name={props.name}
          render={({ value }) => <span>{props.show(value)}</span>}
        />
      );
    }
    expectTypeOf(Field).toBeFunction();
  });

  it('concrete usages infer as before', () => {
    type F = { user: { name: string } };
    const store = {} as StoreApi<FormState<F>>;
    void (
      <FormController
        store={store}
        name="user.name"
        render={({ value }) => {
          expectTypeOf(value).toEqualTypeOf<string>();
          return <span />;
        }}
      />
    );
    void (
      <FormController
        store={store}
        render={({ value }) => {
          expectTypeOf(value).toEqualTypeOf<F>();
          return <span />;
        }}
      />
    );
    const maybe = 'user.name' as 'user.name' | undefined;
    void (
      <FormController store={store} name={maybe} render={() => <span />} />
    );
  });
});
