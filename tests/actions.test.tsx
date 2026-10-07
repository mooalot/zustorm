import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createStore, useStore } from 'zustand';
import {
  createFormStore,
  FormController,
  FormState,
  FormStoreProvider,
  getDefaultForm,
  getFormApi,
  handleSubmit,
  touchAll,
  useFormController,
  useFormStore,
  validateForm,
  withForm,
} from '../src/index';
import {
  formatIssues,
  getErrorMessage,
  getErrorMessages,
  getScopedFormApi,
  resetDirty,
  resetErrors,
} from '../src';
import { getScopedFormState } from '../src/scoped';

type Profile = {
  user: { name: string; email: string };
  tags: string[];
};

const profileSchema = z.object({
  user: z.object({
    name: z.string().min(1, 'Name required'),
    email: z.string().email('Invalid email'),
  }),
  tags: z.array(z.string().min(1, 'Tag required')),
});

const validProfile: Profile = {
  user: { name: 'Ada', email: 'ada@example.com' },
  tags: ['math'],
};

function createProfileStore(values: Profile = validProfile) {
  return createStore<FormState<Profile>>()(
    withForm(() => getDefaultForm(values), { getSchema: () => profileSchema })
  );
}

describe('initialValues baseline', () => {
  it('getDefaultForm and withForm record the initial values', () => {
    expect(getDefaultForm({ a: 1 }).initialValues).toEqual({ a: 1 });

    const store = createStore<FormState<{ a: number }>>()(
      withForm(() => ({ values: { a: 2 } }) as FormState<{ a: number }>, {})
    );
    expect(store.getState().initialValues).toEqual({ a: 2 });
    store.setState({ values: { a: 3 } });
    store.getState().reset();
    expect(store.getState().values).toEqual({ a: 2 });
  });

  it('honours an explicit initialValues supplied by the creator', () => {
    const store = createStore<FormState<{ a: number }>>()(
      withForm(
        () =>
          ({ values: { a: 5 }, initialValues: { a: 1 } }) as FormState<{
            a: number;
          }>,
        {}
      )
    );
    store.getState().reset();
    expect(store.getState().values).toEqual({ a: 1 });
  });

  it('moves the baseline of a scoped reset', () => {
    const store = createProfileStore();
    const scoped = getScopedFormApi(store, 'user.name');

    scoped.getState().reset('Grace');
    expect(store.getState().values.user.name).toBe('Grace');
    expect(store.getState().initialValues?.user.name).toBe('Grace');
    expect(store.getState().initialValues?.user.email).toBe('ada@example.com');

    scoped.setState({ values: 'Edited' });
    scoped.getState().reset();
    expect(store.getState().values.user.name).toBe('Grace');

    scoped.getState().reset('Temp', { keepInitialValues: true });
    expect(store.getState().values.user.name).toBe('Temp');
    expect(store.getState().initialValues?.user.name).toBe('Grace');
  });

  it('exposes the moving baseline through the formPath store', () => {
    const store = createStore<{ form: FormState<{ a: number }>; n: number }>()(
      withForm(() => ({ form: getDefaultForm({ a: 1 }), n: 0 }), {
        formPath: 'form',
      })
    );
    const api = getFormApi(store, 'form');
    api.getState().reset({ a: 10 });
    expect(store.getState().form.initialValues).toEqual({ a: 10 });
    api.setState({ values: { a: 11 } });
    api.getState().reset();
    expect(store.getState().form.values).toEqual({ a: 10 });
    expect(store.getState().n).toBe(0);
  });
});

describe('scoped reset pruning', () => {
  it('drops parent flags when no descendant is dirty or touched', () => {
    const store = createProfileStore();
    const name = getScopedFormApi(store, 'user.name');

    name.setState({ values: 'Changed' });
    expect(store.getState().dirty?.user?._dirty).toBe(true);

    name.getState().reset();
    expect(store.getState().dirty).toBeUndefined();
    expect(store.getState().touched).toBeUndefined();
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().isTouched).toBe(false);
  });

  it('keeps parent flags while a sibling is still dirty', () => {
    const store = createProfileStore();
    const name = getScopedFormApi(store, 'user.name');
    const email = getScopedFormApi(store, 'user.email');

    name.setState({ values: 'Changed' });
    email.setState({ values: 'new@example.com' });
    name.getState().reset();

    const dirty = store.getState().dirty;
    expect(dirty?.user?.name).toBeUndefined();
    expect(dirty?.user?.email?._dirty).toBe(true);
    expect(dirty?.user?._dirty).toBe(true);
    expect(store.getState().isDirty).toBe(true);
  });

  it('prunes on scoped resetTouched and resetDirty as well', () => {
    const store = createProfileStore();
    const name = getScopedFormApi(store, 'user.name');
    name.setState({ values: 'Changed' });

    name.getState().resetTouched();
    expect(store.getState().touched).toBeUndefined();
    expect(store.getState().dirty?.user?.name?._dirty).toBe(true);

    name.getState().resetDirty();
    expect(store.getState().dirty).toBeUndefined();
  });

  it('prunes through nested scoped apis', () => {
    const store = createProfileStore();
    const user = getScopedFormApi(store, 'user');
    const name = getScopedFormApi(user, 'name');

    name.setState({ values: 'Changed' });
    expect(store.getState().dirty?.user?.name?._dirty).toBe(true);

    name.getState().reset();
    expect(store.getState().values.user.name).toBe('Ada');
    expect(store.getState().dirty).toBeUndefined();
  });
});

describe('computed flags', () => {
  it('derives isDirty, isTouched and isValid on the root form', () => {
    const store = createProfileStore({ ...validProfile, tags: [''] });
    let state = store.getState();
    expect(state.isDirty).toBe(false);
    expect(state.isTouched).toBe(false);
    expect(state.isValid).toBe(false);

    store.setState({ values: { ...state.values, tags: ['ok'] } });
    state = store.getState();
    expect(state.isDirty).toBe(true);
    expect(state.isTouched).toBe(true);
    expect(state.isValid).toBe(true);

    store.getState().reset();
    state = store.getState();
    expect(state.isDirty).toBe(false);
    expect(state.isTouched).toBe(false);
    expect(state.isValid).toBe(false);
  });

  it('derives flags for a scope, including parents of invalid fields', () => {
    const store = createProfileStore({
      ...validProfile,
      user: { name: '', email: 'ada@example.com' },
    });
    const state = store.getState();
    expect(getScopedFormState(state, 'user').isValid).toBe(false);
    expect(getScopedFormState(state, 'user.name').isValid).toBe(false);
    expect(getScopedFormState(state, 'user.email').isValid).toBe(true);
    expect(getScopedFormState(state, 'tags').isValid).toBe(true);

    expect(getScopedFormApi(store, 'user').getState().isDirty).toBe(false);
    getScopedFormApi(store, 'user.email').setState({ values: 'x@y.io' });
    expect(getScopedFormApi(store, 'user').getState().isDirty).toBe(true);
    expect(getScopedFormApi(store, 'tags').getState().isDirty).toBe(false);
  });

  it('exposes the flags through FormController render props', () => {
    const store = createProfileStore();
    render(
      <FormController
        store={store}
        name="user.name"
        render={({ value, onChange, onBlur, isDirty, isTouched, isValid }) => (
          <>
            <input
              data-testid="input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
            />
            <div data-testid="flags">
              {[isDirty, isTouched, isValid].join(',')}
            </div>
          </>
        )}
      />
    );
    expect(screen.getByTestId('flags').textContent).toBe('false,false,true');

    fireEvent.blur(screen.getByTestId('input'));
    expect(screen.getByTestId('flags').textContent).toBe('false,true,true');

    fireEvent.change(screen.getByTestId('input'), { target: { value: '' } });
    expect(screen.getByTestId('flags').textContent).toBe('true,true,false');
  });
});

describe('touchAll', () => {
  it('marks every node, including array items and the root', () => {
    const store = createProfileStore();
    touchAll(store);
    const touched = store.getState().touched;
    expect(touched?._touched).toBe(true);
    expect(touched?.user?._touched).toBe(true);
    expect(touched?.user?.name?._touched).toBe(true);
    expect(touched?.user?.email?._touched).toBe(true);
    expect(touched?.tags?._touched).toBe(true);
    expect(touched?.tags?.[0]?._touched).toBe(true);
    expect(store.getState().isTouched).toBe(true);
    expect(store.getState().isDirty).toBe(false);
  });

  it('touches only the scope and its ancestors when scoped', () => {
    const store = createProfileStore();
    getScopedFormApi(store, 'user').getState().touchAll();
    const touched = store.getState().touched;
    expect(touched?.user?._touched).toBe(true);
    expect(touched?.user?.name?._touched).toBe(true);
    expect(touched?.user?.email?._touched).toBe(true);
    expect(touched?.tags).toBeUndefined();
    expect(store.getState().isTouched).toBe(true);
  });

  it('works on a formPath store', () => {
    const store = createStore<{ form: FormState<{ a: { b: number } }> }>()(
      withForm(() => ({ form: getDefaultForm({ a: { b: 1 } }) }), {
        formPath: 'form',
      })
    );
    store.getState().form.touchAll();
    expect(store.getState().form.touched?.a?.b?._touched).toBe(true);
    expect(store.getState().form.isTouched).toBe(true);
  });
});

describe('validate', () => {
  it('restores errors after resetErrors and reports validity', () => {
    const store = createProfileStore({ ...validProfile, tags: [''] });
    expect(store.getState().errors?.tags?.[0]?._errors).toContain(
      'Tag required'
    );

    resetErrors(store);
    expect(store.getState().errors).toBeUndefined();
    expect(store.getState().isValid).toBe(true);

    expect(validateForm(store)).toBe(false);
    expect(store.getState().errors?.tags?.[0]?._errors).toContain(
      'Tag required'
    );
    expect(store.getState().isValid).toBe(false);

    store.setState({ values: validProfile });
    expect(validateForm(store)).toBe(true);
    expect(store.getState().errors).toBeUndefined();
  });

  it('validation written by validate() survives unrelated updates', () => {
    const store = createProfileStore({ ...validProfile, tags: [''] });
    resetErrors(store);
    validateForm(store);
    touchAll(store);
    expect(store.getState().errors?.tags?.[0]?._errors).toContain(
      'Tag required'
    );
  });

  it('returns the validity of the scope only', () => {
    const store = createProfileStore({
      ...validProfile,
      user: { name: '', email: 'ada@example.com' },
    });
    resetErrors(store);
    expect(getScopedFormApi(store, 'user.email').getState().validate()).toBe(
      true
    );
    expect(getScopedFormApi(store, 'user.name').getState().validate()).toBe(
      false
    );
    // The root errors were written by the scoped validate call.
    expect(store.getState().errors?.user?.name?._errors).toContain(
      'Name required'
    );
  });

  it('uses a schema that reads other store state', () => {
    const store = createStore<{
      form: FormState<{ n: number }>;
      max: number;
    }>()(
      withForm(() => ({ form: getDefaultForm({ n: 5 }), max: 10 }), {
        formPath: 'form',
        getSchema: (state) => z.object({ n: z.number().max(state.max) }),
      })
    );
    expect(store.getState().form.validate()).toBe(true);
    store.setState({ max: 1 });
    expect(store.getState().form.isValid).toBe(false);
    expect(store.getState().form.validate()).toBe(false);
  });

  it('returns true when a store has no form at the path', () => {
    const store = createStore<{ form?: FormState<{ n: number }> }>()(
      withForm(() => ({}) as any, { formPath: 'form' } as any)
    );
    expect(store.getState()).toEqual({});
  });
});

describe('handleSubmit', () => {
  it('prevents default, touches everything and calls onValid', async () => {
    const store = createProfileStore();
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    const preventDefault = vi.fn();

    await handleSubmit(store, onValid, onInvalid)({ preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onValid).toHaveBeenCalledWith(validProfile);
    expect(onInvalid).not.toHaveBeenCalled();
    expect(store.getState().isTouched).toBe(true);
  });

  it('calls onInvalid with the errors, even after resetErrors', async () => {
    const store = createProfileStore({ ...validProfile, tags: [''] });
    resetErrors(store);
    const onValid = vi.fn();
    const onInvalid = vi.fn();

    await handleSubmit(store, onValid, onInvalid)();

    expect(onValid).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledOnce();
    expect(onInvalid.mock.calls[0][0].tags[0]._errors).toContain(
      'Tag required'
    );
    expect(store.getState().touched?.tags?.[0]?._touched).toBe(true);
  });

  it('awaits an async onValid', async () => {
    const store = createProfileStore();
    let finished = false;
    await store.getState().handleSubmit(async () => {
      await Promise.resolve();
      finished = true;
    })();
    expect(finished).toBe(true);
  });

  it('submits the scope only when used from a scoped api', async () => {
    const store = createProfileStore({ ...validProfile, tags: [''] });
    const onValid = vi.fn();
    await getScopedFormApi(store, 'user').getState().handleSubmit(onValid)();
    expect(onValid).toHaveBeenCalledWith(validProfile.user);
    expect(store.getState().touched?.user?.name?._touched).toBe(true);
    expect(store.getState().touched?.tags).toBeUndefined();
  });

  it('works as a form onSubmit handler from a render prop', async () => {
    const store = createProfileStore({ ...validProfile, tags: [''] });
    const onValid = vi.fn();
    const onInvalid = vi.fn();

    render(
      <FormController
        store={store}
        render={({ handleSubmit, isTouched }) => (
          <form
            data-testid="form"
            onSubmit={(event) => void handleSubmit(onValid, onInvalid)(event)}
          >
            <span data-testid="touched">{String(isTouched)}</span>
          </form>
        )}
      />
    );
    expect(screen.getByTestId('touched').textContent).toBe('false');

    await act(async () => {
      fireEvent.submit(screen.getByTestId('form'));
    });

    expect(onInvalid).toHaveBeenCalledOnce();
    expect(onValid).not.toHaveBeenCalled();
    expect(screen.getByTestId('touched').textContent).toBe('true');
  });
});

describe('useFormController', () => {
  it('returns the same props as the render prop component', () => {
    const store = createProfileStore();

    function NameField() {
      const { value, onChange, onBlur, error, isDirty, reset } =
        useFormController(store, 'user.name');
      return (
        <>
          <input
            data-testid="input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
          <span data-testid="dirty">{String(isDirty)}</span>
          <span data-testid="error">{error?._errors?.[0] ?? ''}</span>
          <button data-testid="reset" onClick={() => reset()} />
        </>
      );
    }

    render(<NameField />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.value).toBe('Ada');

    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByTestId('dirty').textContent).toBe('true');
    expect(screen.getByTestId('error').textContent).toBe('Name required');

    fireEvent.click(screen.getByTestId('reset'));
    expect(input.value).toBe('Ada');
    expect(screen.getByTestId('dirty').textContent).toBe('false');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('works without a name and with a contextSelector', () => {
    const store = createProfileStore();

    function Whole() {
      const { value, context, isValid } = useFormController(store, undefined, {
        contextSelector: (values) => values.user.email,
      });
      return (
        <span data-testid="out">
          {value.user.name}|{context}|{String(isValid)}
        </span>
      );
    }

    render(<Whole />);
    expect(screen.getByTestId('out').textContent).toBe(
      'Ada|ada@example.com|true'
    );
  });

  it('works with the store from context', () => {
    const store = createProfileStore();

    function Email() {
      const contextStore = useFormStore<Profile>();
      const { value } = useFormController(contextStore, 'user.email');
      return <span data-testid="email">{value}</span>;
    }

    render(
      <FormStoreProvider store={store}>
        <Email />
      </FormStoreProvider>
    );
    expect(screen.getByTestId('email').textContent).toBe('ada@example.com');
  });
});

describe('formatIssues', () => {
  it('matches the shape of Zod error.format()', () => {
    const result = profileSchema.safeParse({
      user: { name: '', email: 'nope' },
      tags: ['', 'ok', ''],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(formatIssues(result.error.issues)).toEqual(result.error.format());
  });

  it('returns undefined for no issues and handles root issues', () => {
    expect(formatIssues([])).toBeUndefined();
    expect(formatIssues([{ path: [], message: 'Root' }])).toEqual({
      _errors: ['Root'],
    });
  });
});

describe('dirty state via selectors', () => {
  it('lets components subscribe to isDirty directly', () => {
    const store = createProfileStore();
    function Flag() {
      const isDirty = useStore(store, (state) => state.isDirty);
      return <span data-testid="flag">{String(isDirty)}</span>;
    }
    render(<Flag />);
    expect(screen.getByTestId('flag').textContent).toBe('false');
    act(() => {
      getScopedFormApi(store, 'tags').setState({ values: ['a', 'b'] });
    });
    expect(screen.getByTestId('flag').textContent).toBe('true');
    act(() => {
      resetDirty(store);
    });
    expect(screen.getByTestId('flag').textContent).toBe('false');
  });
});

describe('error messages', () => {
  it('flattens an errors tree, own messages first then descendants', () => {
    const store = createProfileStore({
      user: { name: '', email: 'nope' },
      tags: ['', 'ok'],
    });
    const errors = store.getState().errors;
    expect(getErrorMessages(errors)).toEqual([
      'Name required',
      'Invalid email',
      'Tag required',
    ]);
    expect(getErrorMessage(errors)).toBe('Name required');
    expect(getErrorMessages(errors?.user)).toEqual([
      'Name required',
      'Invalid email',
    ]);
    expect(getErrorMessage(errors?.user?.email)).toBe('Invalid email');
    expect(getErrorMessage(errors?.tags?.[1])).toBeUndefined();
    expect(getErrorMessages(undefined)).toEqual([]);
    expect(getErrorMessage(undefined)).toBeUndefined();
  });

  it('puts the node message before its children', () => {
    expect(
      getErrorMessages({ _errors: ['Root'], a: { _errors: ['Child'] } })
    ).toEqual(['Root', 'Child']);
  });

  it('exposes errorMessage and errorMessages through render props and the hook', () => {
    const store = createProfileStore({
      user: { name: '', email: 'nope' },
      tags: ['ok'],
    });

    function Hooked() {
      const { errorMessage, errorMessages } = useFormController(store, 'user');
      return (
        <span data-testid="hooked">
          {errorMessage}|{errorMessages.join(',')}
        </span>
      );
    }

    render(
      <>
        <FormController
          store={store}
          name="user.email"
          render={({ value, onChange, errorMessage, errorMessages }) => (
            <>
              <input
                data-testid="email"
                value={value}
                onChange={(e) => onChange(e.target.value)}
              />
              <span data-testid="email-error">
                {errorMessage ?? 'none'}|{errorMessages.length}
              </span>
            </>
          )}
        />
        <Hooked />
      </>
    );

    expect(screen.getByTestId('email-error').textContent).toBe(
      'Invalid email|1'
    );
    expect(screen.getByTestId('hooked').textContent).toBe(
      'Name required|Name required,Invalid email'
    );

    fireEvent.change(screen.getByTestId('email'), {
      target: { value: 'ok@example.com' },
    });
    expect(screen.getByTestId('email-error').textContent).toBe('none|0');
    expect(screen.getByTestId('hooked').textContent).toBe(
      'Name required|Name required'
    );
  });
});

describe('regressions: immutability without immer', () => {
  it('never mutates a previous state object', () => {
    const store = createProfileStore();
    const before = store.getState();
    const snapshot = JSON.stringify(before);

    getScopedFormApi(store, 'user.name').setState({ values: 'Changed' });
    getScopedFormApi(store, 'user.name').getState().touchAll();
    store.getState().touchAll();
    store.getState().validate();
    store.getState().reset({ ...validProfile, tags: ['x'] });

    expect(JSON.stringify(before)).toBe(snapshot);
    expect(before.values.user.name).toBe('Ada');
    expect(before.touched).toBeUndefined();
  });

  it('updaters receive the live value and their result replaces it', () => {
    const store = createProfileStore();
    let received: unknown;
    render(
      <FormController
        store={store}
        name="tags"
        render={({ onChange }) => (
          <button
            data-testid="add"
            onClick={() =>
              onChange((prev) => {
                received = prev;
                return [...prev, 'new'];
              })
            }
          />
        )}
      />
    );
    const previousValues = store.getState().values;
    fireEvent.click(screen.getByTestId('add'));
    expect(received).toBe(previousValues.tags);
    expect(store.getState().values.tags).toEqual(['math', 'new']);
    // untouched branches keep identity, changed branch is new
    expect(store.getState().values.user).toBe(previousValues.user);
    expect(store.getState().values.tags).not.toBe(previousValues.tags);
    expect(previousValues.tags).toEqual(['math']);
  });

  it('onBlur marks only the scope as touched and keeps other slices by identity', () => {
    const store = createProfileStore();
    render(
      <FormController
        store={store}
        name="user.email"
        render={({ onBlur }) => <input data-testid="email" onBlur={onBlur} />}
      />
    );
    const before = store.getState();
    fireEvent.blur(screen.getByTestId('email'));
    const after = store.getState();
    expect(after.touched?.user?.email?._touched).toBe(true);
    expect(after.values).toBe(before.values);
    expect(after.dirty).toBeUndefined();
    expect(after.isTouched).toBe(true);
  });

  it('repeated edits to one field reuse the touched and dirty trees', () => {
    const store = createProfileStore();
    const name = getScopedFormApi(store, 'user.name');
    name.setState({ values: 'a' });
    const { touched, dirty } = store.getState();
    name.setState({ values: 'ab' });
    expect(store.getState().touched).toBe(touched);
    expect(store.getState().dirty).toBe(dirty);
  });
});

describe('regressions: paths', () => {
  it('accepts bracket notation in names', () => {
    const store = createProfileStore();
    render(
      <FormController
        store={store}
        name={'tags[0]' as any}
        render={({ value, onChange }) => (
          <input
            data-testid="tag"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      />
    );
    const input = screen.getByTestId('tag') as HTMLInputElement;
    expect(input.value).toBe('math');
    fireEvent.change(input, { target: { value: 'art' } });
    expect(store.getState().values.tags).toEqual(['art']);
    expect(Array.isArray(store.getState().values.tags)).toBe(true);
    expect(store.getState().dirty?.tags?.[0]?._dirty).toBe(true);
  });

  it('keeps arrays as arrays when writing through a scoped api', () => {
    const store = createProfileStore();
    getScopedFormApi(store, 'tags.0').setState({ values: 'changed' });
    expect(Array.isArray(store.getState().values.tags)).toBe(true);
    expect(store.getState().values.tags).toEqual(['changed']);
  });
});

describe('regressions: computed state', () => {
  it('recomputes flags when only errors change', () => {
    const store = createProfileStore({ ...validProfile, tags: [''] });
    expect(store.getState().isValid).toBe(false);
    resetErrors(store);
    expect(store.getState().errors).toBeUndefined();
    expect(store.getState().isValid).toBe(true);
    store.getState().validate();
    expect(store.getState().isValid).toBe(false);
  });

  it('recomputes flags when only touched changes', () => {
    const store = createProfileStore();
    expect(store.getState().isTouched).toBe(false);
    store.setState({ touched: { user: { name: { _touched: true } } } });
    expect(store.getState().isTouched).toBe(true);
    store.setState({ touched: undefined });
    expect(store.getState().isTouched).toBe(false);
  });

  it('does not run the computer or validation for unrelated store keys', () => {
    let schemaCalls = 0;
    const store = createStore<{
      form: FormState<{ n: number }>;
      counter: number;
    }>()(
      withForm(() => ({ form: getDefaultForm({ n: 1 }), counter: 0 }), {
        formPath: 'form',
        getSchema: () => {
          schemaCalls++;
          return z.object({ n: z.number() });
        },
      })
    );
    const after = schemaCalls;
    const form = store.getState().form;
    store.setState({ counter: 1 });
    store.setState({ counter: 2 });
    expect(store.getState().form).toBe(form);
    expect(schemaCalls).toBe(after);
  });
});

describe('regressions: subscriptions', () => {
  it('a field without contextSelector does not subscribe to the root store', () => {
    const store = createProfileStore();
    const rootSubscribe = vi.spyOn(store, 'subscribe');
    render(
      <FormController
        store={store}
        name="user.name"
        render={({ value }) => <span>{value}</span>}
      />
    );
    // Only the scoped api subscribes to the root, once, for the single field.
    expect(rootSubscribe).toHaveBeenCalledTimes(1);
    rootSubscribe.mockRestore();
  });

  it('a field with contextSelector re-renders on context changes only', () => {
    const store = createProfileStore();
    let renders = 0;
    render(
      <FormController
        store={store}
        name="user.name"
        contextSelector={(values) => values.user.email}
        render={({ context }) => {
          renders++;
          return <span data-testid="ctx">{context}</span>;
        }}
      />
    );
    expect(renders).toBe(1);
    act(() => {
      getScopedFormApi(store, 'tags').setState({ values: ['a'] });
    });
    expect(renders).toBe(1);
    act(() => {
      getScopedFormApi(store, 'user.email').setState({ values: 'x@y.io' });
    });
    expect(renders).toBe(2);
    expect(screen.getByTestId('ctx').textContent).toBe('x@y.io');
  });
});

describe('remaining surface', () => {
  it('createFormStore (deprecated) builds a validating form store', () => {
    const store = createFormStore(
      { name: '' },
      { getSchema: () => z.object({ name: z.string().min(1, 'Required') }) }
    );
    expect(store.getState().isValid).toBe(false);
    store.setState({ values: { name: 'ok' } });
    expect(store.getState().isValid).toBe(true);
    expect(typeof store.getState().reset).toBe('function');
    expect(createFormStore({ a: 1 }).getState().errors).toBeUndefined();
  });

  it('a scoped api exposes the initial slice with actions', () => {
    const store = createProfileStore();
    const scoped = getScopedFormApi(store, 'user.name');
    scoped.setState({ values: 'Changed' });
    const initial = scoped.getInitialState();
    expect(initial.values).toBe('Ada');
    expect(initial.initialValues).toBe('Ada');
    expect(initial.isDirty).toBe(false);
    expect(typeof initial.reset).toBe('function');
    expect(scoped.getState().values).toBe('Changed');
  });

  it('useFormStore throws outside a provider', () => {
    function Orphan() {
      useFormStore();
      return null;
    }
    const silenced = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow(
      'useFormStore must be used within FormStoreProvider'
    );
    silenced.mockRestore();
  });

  it('FormController forwards a custom useStore option', () => {
    const store = createProfileStore();
    const custom = vi.fn((api: any, selector: any) => useStore(api, selector));
    render(
      <FormController
        store={store}
        name="user.name"
        options={{ useStore: custom as any }}
        render={({ value }) => <span data-testid="v">{value}</span>}
      />
    );
    expect(screen.getByTestId('v').textContent).toBe('Ada');
    expect(custom).toHaveBeenCalled();
  });
});

describe('parent and child scopes stay consistent', () => {
  function setup() {
    const store = createProfileStore();
    const renders = { parent: 0, child: 0, sibling: 0 };
    render(
      <>
        <FormController
          store={store}
          name="user"
          render={({ value, onChange, isDirty }) => {
            renders.parent++;
            return (
              <>
                <span data-testid="parent">
                  {value.name}|{value.email}|{String(isDirty)}
                </span>
                <button
                  data-testid="replace-user"
                  onClick={() => onChange({ name: 'Grace', email: 'g@x.io' })}
                />
                <button
                  data-testid="replace-user-same-name"
                  onClick={() => onChange({ ...value, email: 'new@x.io' })}
                />
              </>
            );
          }}
        />
        <FormController
          store={store}
          name="user.name"
          render={({ value, onChange, isDirty }) => {
            renders.child++;
            return (
              <>
                <span data-testid="child">
                  {value}|{String(isDirty)}
                </span>
                <input
                  data-testid="child-input"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                />
              </>
            );
          }}
        />
        <FormController
          store={store}
          name="tags"
          render={({ value }) => {
            renders.sibling++;
            return <span data-testid="sibling">{value.join(',')}</span>;
          }}
        />
      </>
    );
    renders.parent = renders.child = renders.sibling = 0;
    return { store, renders };
  }

  it('replacing the parent object updates the child view', () => {
    const { store, renders } = setup();
    fireEvent.click(screen.getByTestId('replace-user'));
    expect(screen.getByTestId('parent').textContent).toBe('Grace|g@x.io|true');
    expect(screen.getByTestId('child').textContent).toBe('Grace|true');
    expect(store.getState().values.user.name).toBe('Grace');
    expect(renders).toEqual({ parent: 1, child: 1, sibling: 0 });
  });

  it('replacing the parent without changing the child does not re-render the child', () => {
    const { renders } = setup();
    fireEvent.click(screen.getByTestId('replace-user-same-name'));
    expect(screen.getByTestId('parent').textContent).toBe('Ada|new@x.io|true');
    expect(screen.getByTestId('child').textContent).toBe('Ada|false');
    expect(renders).toEqual({ parent: 1, child: 0, sibling: 0 });
  });

  it('editing the child updates the parent view and marks both dirty', () => {
    const { store, renders } = setup();
    fireEvent.change(screen.getByTestId('child-input'), {
      target: { value: 'Lin' },
    });
    expect(screen.getByTestId('child').textContent).toBe('Lin|true');
    expect(screen.getByTestId('parent').textContent).toBe(
      'Lin|ada@example.com|true'
    );
    expect(store.getState().values.user).toEqual({
      name: 'Lin',
      email: 'ada@example.com',
    });
    expect(store.getState().dirty?.user?._dirty).toBe(true);
    expect(store.getState().dirty?.user?.name?._dirty).toBe(true);
    expect(renders).toEqual({ parent: 1, child: 1, sibling: 0 });
  });

  it('plain zustand selectors on the root see the same updates', () => {
    const { store } = setup();
    const seen: string[] = [];
    const unsubscribe = store.subscribe((state) =>
      seen.push(state.values.user.name)
    );
    fireEvent.change(screen.getByTestId('child-input'), {
      target: { value: 'Lin' },
    });
    fireEvent.click(screen.getByTestId('replace-user'));
    unsubscribe();
    expect(seen).toEqual(['Lin', 'Grace']);
  });
});
