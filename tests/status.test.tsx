/**
 * Errors set by hand (server responses, cross-field checks done elsewhere)
 * and the submission status flag.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { create, createStore, useStore } from 'zustand';
import {
  FormController,
  FormState,
  getFormApi,
  getScopedFormApi,
  setError,
  setErrors,
  useFormController,
  withForm,
} from '../src';

type Profile = { user: { name: string; email: string }; tags: string[] };
const values: Profile = {
  user: { name: 'Ada', email: 'ada@example.com' },
  tags: ['math'],
};
const schema = z.object({
  user: z.object({
    name: z.string().min(1, 'Name required'),
    email: z.string().email('Invalid email'),
  }),
  tags: z.array(z.string()),
});
const createProfileStore = () =>
  createStore(withForm(values, { getSchema: () => schema }));

describe('setErrors', () => {
  it('replaces the errors and holds them until the values change', () => {
    const store = createProfileStore();
    expect(store.getState().isValid).toBe(true);

    store.getState().setErrors({
      _errors: ['Server rejected'],
      user: { _errors: [], email: { _errors: ['Email taken'] } },
    });
    expect(store.getState().isValid).toBe(false);
    expect(store.getState().errors?.user?.email?._errors).toEqual([
      'Email taken',
    ]);

    // Unrelated writes keep them.
    store.getState().resetTouched();
    expect(store.getState().errors?._errors).toEqual(['Server rejected']);

    // An edit re-validates against the schema, which wins.
    store.setState({ values: { ...values, tags: ['x'] } });
    expect(store.getState().errors).toBeUndefined();
    expect(store.getState().isValid).toBe(true);
  });

  it('validate() and setErrors(undefined) both clear them', () => {
    const store = createProfileStore();
    store.getState().setErrors({ _errors: ['x'] });
    expect(store.getState().validate()).toBe(true);
    expect(store.getState().errors).toBeUndefined();

    store.getState().setErrors({ _errors: ['x'] });
    store.getState().setErrors(undefined);
    expect(store.getState().isValid).toBe(true);
  });

  it('a scoped setErrors writes only its subtree and keeps siblings', () => {
    const store = createProfileStore();
    store.getState().setError('tags', 'Tags bad');
    const user = getScopedFormApi(store, 'user');
    user.getState().setErrors({ _errors: [], name: { _errors: ['No'] } });
    expect(store.getState().errors).toEqual({
      _errors: [],
      tags: { _errors: ['Tags bad'] },
      user: { _errors: [], name: { _errors: ['No'] } },
    });
    expect(user.getState().isValid).toBe(false);

    user.getState().setErrors(undefined);
    expect(store.getState().errors).toEqual({
      _errors: [],
      tags: { _errors: ['Tags bad'] },
    });
    expect(user.getState().isValid).toBe(true);
  });
});

describe('setError', () => {
  it('sets one field and keeps every other error', () => {
    const store = createProfileStore();
    store.setState({
      values: { ...values, user: { ...values.user, name: '' } },
    });
    expect(store.getState().errors?.user?.name?._errors).toEqual([
      'Name required',
    ]);

    store.getState().setError('user.email', 'Email taken');
    expect(store.getState().errors).toEqual({
      _errors: [],
      user: {
        _errors: [],
        name: { _errors: ['Name required'] },
        email: { _errors: ['Email taken'] },
      },
    });
  });

  it('creates ancestors with empty _errors when there were no errors', () => {
    const store = createProfileStore();
    store.getState().setError('tags.0', ['One', 'Two']);
    expect(store.getState().errors).toEqual({
      _errors: [],
      tags: { _errors: [], '0': { _errors: ['One', 'Two'] } },
    });
    expect(store.getState().isValid).toBe(false);
  });

  it('with one argument sets the message of the form itself', () => {
    const store = createProfileStore();
    store.getState().setError('user.name', 'Field');
    store.getState().setError('Whole form');
    expect(store.getState().errors?._errors).toEqual(['Whole form']);
    expect(store.getState().errors?.user?.name?._errors).toEqual(['Field']);
    // Replaces rather than appends.
    store.getState().setError(['A', 'B']);
    expect(store.getState().errors?._errors).toEqual(['A', 'B']);
  });

  it('scoped: one argument targets the scope, two target a path below it', () => {
    const store = createProfileStore();
    const user = getScopedFormApi(store, 'user');
    user.getState().setError('Bad user');
    user.getState().setError('email', 'Taken');
    expect(store.getState().errors).toEqual({
      _errors: [],
      user: { _errors: ['Bad user'], email: { _errors: ['Taken'] } },
    });
    expect(user.getState().errors?._errors).toEqual(['Bad user']);
    expect(getScopedFormApi(store, 'user.email').getState().errors).toEqual({
      _errors: ['Taken'],
    });
  });

  it('standalone helpers delegate to the actions', () => {
    const store = createProfileStore();
    setError(store, 'user.name', 'Nope');
    setError(store, 'Root');
    expect(store.getState().errors?.user?.name?._errors).toEqual(['Nope']);
    expect(store.getState().errors?._errors).toEqual(['Root']);
    setErrors(store, undefined);
    expect(store.getState().isValid).toBe(true);
  });

  it('writes into the form object when the form lives at formPath', () => {
    type App = { form: FormState<Profile>; theme: string };
    const app = create<App>()(
      withForm(() => ({ form: { values }, theme: 'light' }), {
        formPath: 'form',
      })
    );
    app.getState().form.setError('user.email', 'Taken');
    expect(app.getState().form.errors?.user?.email?._errors).toEqual(['Taken']);
    expect(app.getState().form.isValid).toBe(false);
    expect(Object.keys(app.getState())).toEqual(['form', 'theme']);
    expect(getFormApi(app, 'form').getState().isValid).toBe(false);
  });

  it('is available from the controller and the hook', () => {
    const store = createProfileStore();
    let fromHook: ReturnType<typeof useFormController<Profile>> | undefined;
    function Hooked() {
      fromHook = useFormController(store);
      return null;
    }
    render(
      <>
        <Hooked />
        <FormController
          store={store}
          name="user.email"
          render={({ value, onChange, errorMessage, setError }) => (
            <>
              <input
                data-testid="email"
                value={value}
                onChange={(e) => onChange(e.target.value)}
              />
              <button data-testid="taken" onClick={() => setError('Taken')} />
              <span data-testid="msg">{errorMessage ?? ''}</span>
            </>
          )}
        />
      </>
    );
    fireEvent.click(screen.getByTestId('taken'));
    expect(screen.getByTestId('msg').textContent).toBe('Taken');

    act(() => fromHook!.setError('user.name', 'Also bad'));
    expect(store.getState().errors?.user?.name?._errors).toEqual(['Also bad']);
    act(() => fromHook!.setErrors(undefined));
    expect(screen.getByTestId('msg').textContent).toBe('');

    // Typing clears a server error for that field: the schema re-validates.
    fireEvent.click(screen.getByTestId('taken'));
    fireEvent.change(screen.getByTestId('email'), {
      target: { value: 'new@example.com' },
    });
    expect(screen.getByTestId('msg').textContent).toBe('');
  });
});

describe('isSubmitting', () => {
  function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => (resolve = r));
    return { promise, resolve };
  }

  it('is false initially, true while onValid runs, false after', async () => {
    const store = createProfileStore();
    expect(store.getState().isSubmitting).toBe(false);
    const { promise, resolve } = deferred();
    const seen: boolean[] = [];
    const submit = store.getState().handleSubmit(async () => {
      seen.push(store.getState().isSubmitting);
      await promise;
    });
    const done = submit();
    expect(store.getState().isSubmitting).toBe(true);
    resolve();
    await done;
    expect(seen).toEqual([true]);
    expect(store.getState().isSubmitting).toBe(false);
  });

  it('is true during onInvalid and false after a thrown error', async () => {
    const store = createProfileStore();
    store.setState({
      values: { ...values, user: { ...values.user, name: '' } },
    });
    const onInvalid = vi.fn(() => {
      expect(store.getState().isSubmitting).toBe(true);
    });
    await store.getState().handleSubmit(() => {}, onInvalid)();
    expect(onInvalid).toHaveBeenCalledOnce();
    expect(store.getState().isSubmitting).toBe(false);

    store.setState({ values });
    await expect(
      store.getState().handleSubmit(() => {
        throw new Error('boom');
      })()
    ).rejects.toThrow('boom');
    expect(store.getState().isSubmitting).toBe(false);
  });

  it('a scoped submit flips the whole form and notifies scoped subscribers', async () => {
    const store = createProfileStore();
    const user = getScopedFormApi(store, 'user');
    const tags = getScopedFormApi(store, 'tags');
    const seen: boolean[] = [];
    tags.subscribe((state) => seen.push(state.isSubmitting));
    expect(user.getState().isSubmitting).toBe(false);

    const { promise, resolve } = deferred();
    const done = user.getState().handleSubmit(() => promise)();
    expect(store.getState().isSubmitting).toBe(true);
    expect(user.getState().isSubmitting).toBe(true);
    expect(tags.getState().isSubmitting).toBe(true);
    resolve();
    await done;
    expect(seen).toEqual([true, false]);
    expect(tags.getState().isSubmitting).toBe(false);
  });

  it('a scoped state keeps its identity when only unrelated slices change', () => {
    const store = createProfileStore();
    const tags = getScopedFormApi(store, 'tags');
    const before = tags.getState();
    store.getState().setError('user.name', 'x');
    expect(tags.getState()).toBe(before);
    store.setState({ isSubmitting: true });
    expect(tags.getState()).not.toBe(before);
    expect(tags.getState().isSubmitting).toBe(true);
  });

  it('drives a submit button through a selector and a controller', async () => {
    const store = createProfileStore();
    const { promise, resolve } = deferred();
    let headerRenders = 0;
    function Header() {
      headerRenders++;
      const isSubmitting = useStore(store, (s) => s.isSubmitting);
      const handleSubmit = useStore(store, (s) => s.handleSubmit);
      return (
        <button
          data-testid="save"
          disabled={isSubmitting}
          onClick={handleSubmit(() => promise)}
        >
          {isSubmitting ? 'Saving' : 'Save'}
        </button>
      );
    }
    render(
      <>
        <Header />
        <FormController
          store={store}
          name="user.name"
          render={({ isSubmitting }) => (
            <span data-testid="field">{String(isSubmitting)}</span>
          )}
        />
      </>
    );
    expect(screen.getByTestId('save')).toBeEnabled();
    fireEvent.click(screen.getByTestId('save'));
    expect(screen.getByTestId('save')).toBeDisabled();
    expect(screen.getByTestId('save').textContent).toBe('Saving');
    expect(screen.getByTestId('field').textContent).toBe('true');
    await act(async () => {
      resolve();
      await promise;
    });
    expect(screen.getByTestId('save')).toBeEnabled();
    expect(screen.getByTestId('field').textContent).toBe('false');
    expect(headerRenders).toBe(3);
  });
});
