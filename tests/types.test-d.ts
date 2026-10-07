/**
 * Type-level tests, run by `npm run test:types` (vitest typecheck mode). They
 * never execute: `expectTypeOf` assertions and `@ts-expect-error` lines are
 * checked by the compiler, so a regression in inference fails the build.
 */
import * as v from 'valibot';
import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { create, createStore, StoreApi } from 'zustand';
import {
  BaseFormState,
  createSchema,
  DeepKeys,
  DeepValue,
  Dirty,
  Errors,
  FormActions,
  FormController,
  FormControllerRenderProps,
  FormInput,
  FormState,
  FormSchema,
  FormStoreProvider,
  getDefaultForm,
  getErrorMessage,
  getErrorMessages,
  getFormApi,
  getScopedFormApi,
  handleSubmit,
  InferSchemaOutput,
  resetForm,
  StandardSchema,
  SubmitHandler,
  Touched,
  useFormController,
  withForm,
} from '../src';

type Profile = {
  user: { name: string; age: number };
  tags: string[];
  friends: { name: string; emails: string[] }[];
};

declare const store: StoreApi<FormState<Profile>>;
type App = { form: FormState<Profile>; counter: number };
declare const app: StoreApi<App>;

describe('DeepKeys and DeepValue', () => {
  it('enumerates dotted and tuple paths', () => {
    type Keys = DeepKeys<Profile>;
    expectTypeOf<'user'>().toMatchTypeOf<Keys>();
    expectTypeOf<'user.name'>().toMatchTypeOf<Keys>();
    expectTypeOf<'tags'>().toMatchTypeOf<Keys>();
    expectTypeOf<`tags.${number}`>().toMatchTypeOf<Keys>();
    expectTypeOf<'friends.0.emails.2'>().toMatchTypeOf<Keys>();
    expectTypeOf<['user', 'age']>().toMatchTypeOf<Keys>();
    expectTypeOf<['friends', number, 'name']>().toMatchTypeOf<Keys>();
    expectTypeOf<'user.nope'>().not.toMatchTypeOf<Keys>();
    expectTypeOf<'nope'>().not.toMatchTypeOf<Keys>();
  });

  it('resolves the value at a path', () => {
    expectTypeOf<DeepValue<Profile, 'user'>>().toEqualTypeOf<{
      name: string;
      age: number;
    }>();
    expectTypeOf<DeepValue<Profile, 'user.age'>>().toEqualTypeOf<number>();
    expectTypeOf<DeepValue<Profile, 'tags.3'>>().toEqualTypeOf<string>();
    expectTypeOf<DeepValue<Profile, ['friends', 0, 'emails']>>().toEqualTypeOf<
      string[]
    >();
    expectTypeOf<
      DeepValue<Profile, 'friends.1.emails.0'>
    >().toEqualTypeOf<string>();
  });
});

describe('FormState', () => {
  it('carries data, flags and actions', () => {
    expectTypeOf<FormState<Profile>['values']>().toEqualTypeOf<Profile>();
    expectTypeOf<FormState<Profile>['initialValues']>().toEqualTypeOf<
      Profile | undefined
    >();
    expectTypeOf<FormState<Profile>['isDirty']>().toEqualTypeOf<boolean>();
    expectTypeOf<FormState<Profile>['isTouched']>().toEqualTypeOf<boolean>();
    expectTypeOf<FormState<Profile>['isValid']>().toEqualTypeOf<boolean>();
    expectTypeOf<FormState<Profile>>().toMatchTypeOf<FormActions<Profile>>();
    expectTypeOf<FormState<Profile>>().toMatchTypeOf<BaseFormState<Profile>>();
  });

  it('types the nested trees to mirror the values', () => {
    type E = NonNullable<FormState<Profile>['errors']>;
    expectTypeOf<E['_errors']>().toEqualTypeOf<string[] | undefined>();
    expectTypeOf<
      NonNullable<NonNullable<E['user']>['name']>['_errors']
    >().toEqualTypeOf<string[] | undefined>();
    expectTypeOf<NonNullable<E['friends']>[number]>().toMatchTypeOf<{
      _errors?: string[];
    }>();

    type T = NonNullable<Touched<Profile>['user']>;
    expectTypeOf<T['_touched']>().toEqualTypeOf<boolean | undefined>();
    type D = NonNullable<Dirty<Profile>['tags']>;
    expectTypeOf<D['_dirty']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<Errors<Profile>>().toMatchTypeOf<{ _errors?: string[] }>();
  });

  it('types the actions', () => {
    const actions = store.getState();
    expectTypeOf(actions.reset)
      .parameter(0)
      .toEqualTypeOf<Profile | undefined>();
    expectTypeOf(actions.reset)
      .parameter(1)
      .toMatchTypeOf<{ keepInitialValues?: boolean } | undefined>();
    expectTypeOf(actions.validate).returns.toEqualTypeOf<boolean>();
    expectTypeOf(actions.touchAll).returns.toEqualTypeOf<void>();
    expectTypeOf(actions.handleSubmit).returns.toEqualTypeOf<SubmitHandler>();
    expectTypeOf(actions.handleSubmit)
      .parameter(0)
      .parameter(0)
      .toEqualTypeOf<Profile>();
    expectTypeOf(actions.handleSubmit)
      .parameter(1)
      .toEqualTypeOf<
        ((errors: Errors<Profile>) => void | Promise<void>) | undefined
      >();
    // @ts-expect-error reset needs the whole values object, not a field
    actions.reset({ user: { name: 'x', age: 1 } });
  });
});

describe('withForm', () => {
  it('infers the form type from a root form creator', () => {
    const useForm = create(
      withForm(() => ({ values: {} as Profile }), {
        getSchema: (state) => {
          // Structurally the full form state (an intersection, so not identical).
          expectTypeOf(state).toMatchTypeOf<FormState<Profile>>();
          expectTypeOf<FormState<Profile>>().toMatchTypeOf(state);
          return z.object({}) as unknown as z.ZodType<Profile>;
        },
      })
    );
    expectTypeOf(useForm.getState().values).toEqualTypeOf<Profile>();
    expectTypeOf(useForm.getState().errors).toEqualTypeOf<
      Errors<Profile> | undefined
    >();
    expectTypeOf(useForm.getState().reset).toBeFunction();
    expectTypeOf(useForm((s) => s.isValid)).toEqualTypeOf<boolean>();
  });

  it('requires formPath when the store is not itself a form', () => {
    const app = createStore<App>()(
      withForm(() => ({ form: { values: {} as Profile }, counter: 0 }), {
        formPath: 'form',
        getSchema: (state) => {
          expectTypeOf(state).toEqualTypeOf<App>();
          return z.object({}) as unknown as z.ZodType<Profile>;
        },
      })
    );
    expectTypeOf(app.getState().form.values).toEqualTypeOf<Profile>();
    expectTypeOf(app.getState().counter).toEqualTypeOf<number>();

    createStore<App>()(
      // @ts-expect-error formPath is required for a store that is not a form
      withForm(() => ({ form: { values: {} as Profile }, counter: 0 }), {})
    );
    createStore<App>()(
      // @ts-expect-error unknown path
      withForm(() => ({ form: { values: {} as Profile }, counter: 0 }), {
        formPath: 'nope',
      })
    );
  });
});

describe('useFormController', () => {
  it('infers the field value from the name', () => {
    function Component() {
      const name = useFormController(store, 'user.name');
      expectTypeOf(name.value).toEqualTypeOf<string>();
      expectTypeOf(name.onChange)
        .parameter(0)
        .toEqualTypeOf<string | ((value: string) => string)>();
      expectTypeOf(name.reset).parameter(0).toEqualTypeOf<string | undefined>();
      expectTypeOf(name.errorMessage).toEqualTypeOf<string | undefined>();
      expectTypeOf(name.errorMessages).toEqualTypeOf<string[]>();
      expectTypeOf(name.isDirty).toEqualTypeOf<boolean>();

      const age = useFormController(store, ['user', 'age'] as const);
      expectTypeOf(age.value).toEqualTypeOf<number>();

      const friends = useFormController(store, 'friends');
      expectTypeOf(friends.value).toEqualTypeOf<
        { name: string; emails: string[] }[]
      >();
      expectTypeOf(friends.error).toMatchTypeOf<
        | ({ _errors?: string[] } & Record<number, { _errors?: string[] }>)
        | undefined
      >();

      const whole = useFormController(store);
      expectTypeOf(whole.value).toEqualTypeOf<Profile>();
      expectTypeOf(whole.onFormChange)
        .parameter(0)
        .toEqualTypeOf<Profile | ((form: Profile) => Profile)>();
      expectTypeOf(whole.handleSubmit)
        .parameter(0)
        .parameter(0)
        .toEqualTypeOf<Profile>();

      const withContext = useFormController(store, undefined, {
        contextSelector: (values) => {
          expectTypeOf(values).toEqualTypeOf<Profile>();
          return values.user.age;
        },
      });
      expectTypeOf(withContext.context).toEqualTypeOf<number>();

      // @ts-expect-error unknown path
      useFormController(store, 'user.nope');
      // @ts-expect-error wrong value type for the field
      name.onChange(42);
      return null;
    }
    expectTypeOf(Component).returns.toEqualTypeOf<null>();
  });
});

describe('FormController', () => {
  it('types the render props from the name', () => {
    FormController({
      store,
      name: 'tags',
      render: (props) => {
        expectTypeOf(props.value).toEqualTypeOf<string[]>();
        expectTypeOf(props).toMatchTypeOf<
          FormControllerRenderProps<string[], Profile>
        >();
        return null as unknown as JSX.Element;
      },
    });
    FormController({
      store,
      name: 'friends.0.emails.1',
      contextSelector: (values) => values.tags.length,
      render: ({ value, context, onBlur, touched }) => {
        expectTypeOf(value).toEqualTypeOf<string>();
        expectTypeOf(context).toEqualTypeOf<number>();
        expectTypeOf(onBlur).toEqualTypeOf<(() => void) | undefined>();
        expectTypeOf(touched).toMatchTypeOf<
          { _touched?: boolean } | undefined
        >();
        return null as unknown as JSX.Element;
      },
    });
    FormController({
      store,
      // @ts-expect-error unknown path
      name: 'tags.x.y',
      render: () => null as unknown as JSX.Element,
    });
  });
});

describe('scoped and standalone apis', () => {
  it('scope stores to a path with the right value type', () => {
    const user = getScopedFormApi(store, 'user');
    expectTypeOf(user).toEqualTypeOf<
      StoreApi<FormState<{ name: string; age: number }>>
    >();
    expectTypeOf(user.getState().values.age).toEqualTypeOf<number>();
    expectTypeOf(user.getState().reset)
      .parameter(0)
      .toEqualTypeOf<{ name: string; age: number } | undefined>();

    const form = getFormApi(app, 'form');
    expectTypeOf(form).toEqualTypeOf<StoreApi<FormState<Profile>>>();

    // @ts-expect-error unknown path
    getScopedFormApi(store, 'user.nope');
  });

  it('type the standalone helpers', () => {
    expectTypeOf(resetForm<Profile>)
      .parameter(1)
      .toEqualTypeOf<Profile | undefined>();
    expectTypeOf(
      handleSubmit(store, (values) => {
        expectTypeOf(values).toEqualTypeOf<Profile>();
      })
    ).toEqualTypeOf<SubmitHandler>();
    expectTypeOf(getErrorMessages(store.getState().errors)).toEqualTypeOf<
      string[]
    >();
    expectTypeOf(getErrorMessage(undefined)).toEqualTypeOf<
      string | undefined
    >();
    // @ts-expect-error values must match the form type
    resetForm(store, { user: { name: 'x' } });
  });

  it('types the provider scope name', () => {
    FormStoreProvider({ store, options: { name: 'user' } });
    FormStoreProvider({ store, options: { name: ['friends', 0] } });
    // @ts-expect-error unknown path
    FormStoreProvider({ store, options: { name: 'user.nope' } });
  });
});

describe('path edge cases', () => {
  type Edge = {
    opt?: { b: string; deep?: { c: number } };
    ro: readonly string[];
    when: Date;
    file: File;
    fn: () => void;
    nested: { list?: { x: number }[] };
    map: Map<string, number>;
  };
  type Keys = DeepKeys<Edge>;

  it('traverses optional objects and reports possibly-undefined values', () => {
    expectTypeOf<'opt'>().toMatchTypeOf<Keys>();
    expectTypeOf<'opt.b'>().toMatchTypeOf<Keys>();
    expectTypeOf<'opt.deep.c'>().toMatchTypeOf<Keys>();
    expectTypeOf<'nested.list.0.x'>().toMatchTypeOf<Keys>();
    expectTypeOf<['opt', 'deep', 'c']>().toMatchTypeOf<Keys>();
    expectTypeOf<DeepValue<Edge, 'opt.b'>>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<DeepValue<Edge, 'opt.deep.c'>>().toEqualTypeOf<
      number | undefined
    >();
    expectTypeOf<DeepValue<Edge, 'nested.list.0.x'>>().toEqualTypeOf<
      number | undefined
    >();
    expectTypeOf<DeepValue<Edge, 'nested'>>().toEqualTypeOf<{
      list?: { x: number }[];
    }>();
  });

  it('treats readonly arrays as arrays', () => {
    expectTypeOf<'ro.0'>().toMatchTypeOf<Keys>();
    expectTypeOf<DeepValue<Edge, 'ro.0'>>().toEqualTypeOf<string>();
    expectTypeOf<DeepValue<Edge, ['ro', 1]>>().toEqualTypeOf<string>();
    expectTypeOf<'ro.length'>().not.toMatchTypeOf<Keys>();
  });

  it('does not descend into Date, File, Map or functions', () => {
    expectTypeOf<'when'>().toMatchTypeOf<Keys>();
    expectTypeOf<'when.getTime'>().not.toMatchTypeOf<Keys>();
    expectTypeOf<'file.name'>().not.toMatchTypeOf<Keys>();
    expectTypeOf<'map.size'>().not.toMatchTypeOf<Keys>();
    // a function-valued field is addressable as a whole, never descended into
    expectTypeOf<'fn'>().toMatchTypeOf<Keys>();
    expectTypeOf<'fn.call'>().not.toMatchTypeOf<Keys>();
    expectTypeOf<DeepValue<Edge, 'when'>>().toMatchTypeOf<Date>();
    expectTypeOf<Date>().toMatchTypeOf<DeepValue<Edge, 'when'>>();
    type E = NonNullable<Errors<Edge>['when']>;
    expectTypeOf<E>().toMatchTypeOf<{ _errors?: string[] }>();
    expectTypeOf<keyof E>().toEqualTypeOf<'_errors'>();
  });
});

describe('withForm initialization forms', () => {
  it('accepts initial values directly', () => {
    const useForm = create(
      withForm<Profile>({} as Profile, {
        getSchema: (state) => {
          expectTypeOf(state).toEqualTypeOf<FormState<Profile>>();
          return undefined;
        },
      })
    );
    expectTypeOf(useForm.getState()).toEqualTypeOf<FormState<Profile>>();
    // @ts-expect-error values must match the declared type
    withForm<Profile>({ user: { name: 'x' } });
  });

  it('accepts a creator returning plain { values } and keeps extra keys', () => {
    type Store = FormState<Profile> & {
      submitCount: number;
      submitted: () => void;
    };
    const useForm = create<Store>()(
      withForm(
        (set, get) => ({
          values: {} as Profile,
          submitCount: 0,
          submitted: () => {
            // set/get see the enhanced state, including the actions
            expectTypeOf(get().isValid).toEqualTypeOf<boolean>();
            get().reset();
            set({ submitCount: get().submitCount + 1 });
          },
        }),
        {
          getSchema: (state) => {
            expectTypeOf(state.values).toEqualTypeOf<Profile>();
            expectTypeOf(state.submitCount).toEqualTypeOf<number>();
            return undefined;
          },
        }
      )
    );
    const state = useForm.getState();
    expectTypeOf(state.values).toEqualTypeOf<Profile>();
    expectTypeOf(state.submitCount).toEqualTypeOf<number>();
    expectTypeOf(state.reset).parameter(0).toEqualTypeOf<Profile | undefined>();
    expectTypeOf(state.isDirty).toEqualTypeOf<boolean>();
    expectTypeOf(useForm).toMatchTypeOf<StoreApi<FormState<Profile>>>();
  });

  it('accepts a creator with a plain form at formPath and keeps the rest', () => {
    type App = {
      form: FormState<Profile>;
      theme: 'light' | 'dark';
      toggle: () => void;
    };
    const useApp = create<App>()(
      withForm(
        (set, get) => ({
          form: { values: {} as Profile },
          theme: 'light' as 'light' | 'dark',
          toggle: () => {
            get().form.validate();
            set({ theme: get().theme === 'light' ? 'dark' : 'light' });
          },
        }),
        {
          formPath: 'form',
          getSchema: (state) => {
            expectTypeOf(state.theme).toEqualTypeOf<'light' | 'dark'>();
            expectTypeOf(state.form.values).toEqualTypeOf<Profile>();
            return undefined;
          },
        }
      )
    );
    const state = useApp.getState();
    expectTypeOf(state.form.values).toEqualTypeOf<Profile>();
    expectTypeOf(state.form.isValid).toEqualTypeOf<boolean>();
    expectTypeOf(state.form.reset)
      .parameter(0)
      .toEqualTypeOf<Profile | undefined>();
    expectTypeOf(state.theme).toEqualTypeOf<'light' | 'dark'>();
    expectTypeOf(state.toggle).toEqualTypeOf<() => void>();
    expectTypeOf(getFormApi(useApp, 'form')).toEqualTypeOf<
      StoreApi<FormState<Profile>>
    >();
  });

  it('infers from a creator without set/get and no explicit type', () => {
    const useForm = create(
      withForm(() => ({ values: {} as Profile, submitCount: 0 }), {
        getSchema: (state) => {
          expectTypeOf(state.submitCount).toEqualTypeOf<number>();
          return undefined;
        },
      })
    );
    expectTypeOf(useForm.getState().values).toEqualTypeOf<Profile>();
    expectTypeOf(useForm.getState().submitCount).toEqualTypeOf<number>();
    expectTypeOf(useForm.getState().isValid).toEqualTypeOf<boolean>();

    const useApp = create(
      withForm(() => ({ form: { values: {} as Profile }, theme: 'light' }), {
        formPath: 'form',
      })
    );
    expectTypeOf(useApp.getState().form.isValid).toEqualTypeOf<boolean>();
    expectTypeOf(useApp.getState().theme).toEqualTypeOf<string>();
  });

  it('still accepts the deprecated getDefaultForm and an explicit store type', () => {
    expectTypeOf(getDefaultForm({} as Profile)).toEqualTypeOf<
      FormInput<Profile>
    >();
    const s = createStore<FormState<Profile>>()(
      withForm(() => getDefaultForm({} as Profile))
    );
    expectTypeOf(s.getState().values).toEqualTypeOf<Profile>();
    type App = { form: FormState<Profile>; counter: number };
    const app = createStore<App>()(
      withForm(() => ({ form: { values: {} as Profile }, counter: 0 }), {
        formPath: 'form',
      })
    );
    expectTypeOf(app.getState().form.touchAll).toEqualTypeOf<() => void>();
  });
});

describe('withForm call shapes', () => {
  type P = { a: number };
  type Store = FormState<P> & { n: number; inc: () => void };
  type App = {
    form: FormState<P>;
    theme: 'light' | 'dark';
    toggle: () => void;
  };

  it('curried store type, creator with set/get, form at root', () => {
    const useStore = create<Store>()(
      withForm(
        (set, get) => ({
          values: { a: 1 },
          n: 0,
          inc: () => {
            get().reset();
            set({ n: get().n + 1 });
          },
        }),
        {
          getSchema: (state) => {
            expectTypeOf(state).toEqualTypeOf<Store>();
            return undefined;
          },
        }
      )
    );
    expectTypeOf(useStore.getState()).toEqualTypeOf<Store>();
  });

  it('curried store type, creator with set/get, form at a path', () => {
    const useApp = create<App>()(
      withForm(
        (set, get) => ({
          form: { values: { a: 1 } },
          theme: 'light',
          toggle: () => {
            get().form.validate();
            set({ theme: get().theme === 'light' ? 'dark' : 'light' });
          },
        }),
        {
          formPath: 'form',
          getSchema: (state) => {
            expectTypeOf(state).toEqualTypeOf<App>();
            return undefined;
          },
        }
      )
    );
    expectTypeOf(useApp.getState()).toEqualTypeOf<App>();
  });

  it('curried store type, creator without set/get', () => {
    create<Store>()(
      withForm(() => ({ values: { a: 1 }, n: 0, inc: () => {} }))
    );
    create<App>()(
      withForm(
        () => ({
          form: { values: { a: 1 } },
          theme: 'light',
          toggle: () => {},
        }),
        {
          formPath: 'form',
        }
      )
    );
    createStore<FormState<P>>()(withForm(() => ({ values: { a: 1 } })));
    create<Store>()(
      // @ts-expect-error wrong values shape under an explicit type
      withForm(() => ({ values: { a: 'no' }, n: 0, inc: () => {} }))
    );
    createStore<App>()(
      withForm(
        // @ts-expect-error unknown formPath
        () => ({
          form: { values: { a: 1 } },
          theme: 'light',
          toggle: () => {},
        }),
        {
          formPath: 'nope',
        }
      )
    );
  });

  it('inferred store type from a creator without set/get', () => {
    const root = create(withForm(() => ({ values: { a: 1 }, n: 0 })));
    expectTypeOf(root.getState().values).toEqualTypeOf<{ a: number }>();
    expectTypeOf(root.getState().n).toEqualTypeOf<number>();
    expectTypeOf(root.getState().isValid).toEqualTypeOf<boolean>();

    const at = create(
      withForm(() => ({ form: { values: { a: 1 } }, theme: 'light' }), {
        formPath: 'form',
      })
    );
    expectTypeOf(at.getState().form.values).toEqualTypeOf<{ a: number }>();
    expectTypeOf(at.getState().form.touchAll).toEqualTypeOf<() => void>();
    expectTypeOf(at.getState().theme).toEqualTypeOf<string>();
  });

  it('initial values', () => {
    const useForm = create(withForm({ a: 1 }));
    expectTypeOf(useForm.getState()).toEqualTypeOf<FormState<{ a: number }>>();
    useForm.getState().reset({ a: 2 });
    // @ts-expect-error reset takes the values type
    useForm.getState().reset({ a: 'x' });
  });
});

describe('schemas', () => {
  type User = { name: string; age: number };
  const zodUser = z.object({ name: z.string(), age: z.number() });
  const valibotUser = v.object({ name: v.string(), age: v.number() });

  it('getSchema accepts any Standard Schema whose output fits the values', () => {
    createStore(
      withForm<User>({ name: '', age: 0 }, { getSchema: () => zodUser })
    );
    createStore(
      withForm<User>({ name: '', age: 0 }, { getSchema: () => valibotUser })
    );
    createStore(
      withForm<User>(
        { name: '', age: 0 },
        { getSchema: () => createSchema<User>(() => undefined) }
      )
    );
    // A narrower output is fine: the schema may validate more than the form holds.
    createStore(
      withForm<{ name: string }>({ name: '' }, { getSchema: () => zodUser })
    );
    createStore(
      // @ts-expect-error the schema's output does not match the values
      withForm<User>(
        { name: '', age: 0 },
        { getSchema: () => z.object({ name: z.number() }) }
      )
    );
    createStore(
      // @ts-expect-error not a schema
      withForm<User>(
        { name: '', age: 0 },
        { getSchema: () => ({ validate: () => true }) }
      )
    );
  });

  it('createSchema is typed by the values it validates', () => {
    const schema = createSchema<User>((values) => {
      expectTypeOf(values).toEqualTypeOf<User>();
      return [
        { path: 'name', message: 'x' },
        { path: ['age'], message: 'y' },
      ];
    });
    expectTypeOf(schema).toEqualTypeOf<StandardSchema<User, User>>();
    expectTypeOf(schema).toMatchTypeOf<FormSchema<User>>();
    expectTypeOf<InferSchemaOutput<typeof schema>>().toEqualTypeOf<User>();
    expectTypeOf<InferSchemaOutput<typeof valibotUser>>().toEqualTypeOf<User>();
    createSchema<User>(() => [
      // @ts-expect-error a path must be a string or an array of keys
      { path: { key: 'name' }, message: 'x' },
    ]);
  });
});
