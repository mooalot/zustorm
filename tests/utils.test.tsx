import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { z, ZodType } from 'zod';
import { create, createStore, useStore } from 'zustand';
import { FormController, FormStoreProvider } from '../src/components';
import {
  DeepKeys,
  FormControllerProps,
  FormRenderProps,
  FormState,
} from '../src/types';
import {
  getDefaultForm,
  getFormApi,
  getScopedApi,
  getScopedFormApi,
  getScopedFormState,
  setWithOptionalPath,
  useFormStore,
  withForm,
} from '../src/utils';

export const createFormStore = <T extends object>(
  initialValue: T,
  options?: {
    /**
     * The function to get the schema for the form. This is useful for custom validation logic.
     * It can be a function that returns a Zod schema or a Zod schema itself.
     */
    getSchema?: (state: FormState<T>) => ZodType<T>;
  }
) => {
  return createStore<FormState<T>>()(
    withForm(() => getDefaultForm(initialValue), {
      getSchema: options?.getSchema,
    })
  );
};

describe('setWithOptionalPath', () => {
  it('should set a value at the specified path', () => {
    const state = { a: { b: { c: 1 } } };
    setWithOptionalPath(state, 'a.b.c', 2);
    expect(state.a.b.c).toBe(2);
  });
});

describe('getScopedApi', () => {
  it('should return a scoped API with the correct type', () => {
    const api = createStore(() => ({
      test: {
        value: 'initial',
      },
    }));

    const scopedApi = getScopedApi(api, 'test');
    expect(scopedApi.getState().value).toBe('initial');
    scopedApi.setState({ value: 'updated' });
    expect(scopedApi.getState().value).toBe('updated');
  });

  it('should return a scoped API with path as array of strings', () => {
    const api = createStore(() => ({
      test: {
        value: 'initial',
      },
    }));

    const scopedApi = getScopedApi(api, ['test'] as const);
    expect(scopedApi.getState().value).toBe('initial');
    scopedApi.setState({ value: 'updated' });
    expect(scopedApi.getState().value).toBe('updated');
  });
});

describe('getScopedFormState', () => {
  it('should return a scoped form state with the correct type', () => {
    const formState: FormState<{ test: { value: string } }> = {
      values: { test: { value: 'initial' } },
    };

    const scopedState = getScopedFormState(formState, 'test');
    expect(scopedState.values.value).toBe('initial');
  });

  it('should return a scoped form state with path as array of strings', () => {
    const formState: FormState<{ test: { value: string } }> = {
      values: { test: { value: 'initial' } },
    };

    const scopedState = getScopedFormState(formState, ['test'] as const);
    expect(scopedState.values.value).toBe('initial');
  });
});

describe('getScopedFormApi', () => {
  it('should return a scoped form API with the correct type', () => {
    const formStore = createStore<FormState<{ test: { value: string } }>>(
      () => ({
        values: { test: { value: 'initial' } },
        errors: undefined,
      })
    );

    const scopedApi = getScopedFormApi(formStore, 'test');
    expect(scopedApi.getState().values.value).toBe('initial');
    scopedApi.setState({ values: { value: 'updated' } });
    expect(scopedApi.getState().values.value).toBe('updated');
  });

  it('should return a scoped form API with path as array of strings', () => {
    const formStore = createStore<FormState<{ test: { value: string } }>>(
      () => ({
        values: { test: { value: 'initial' } },
        errors: undefined,
      })
    );

    const scopedApi = getScopedFormApi(formStore, ['test'] as const);
    expect(scopedApi.getState().values.value).toBe('initial');
    scopedApi.setState({ values: { value: 'updated' } });
    expect(scopedApi.getState().values.value).toBe('updated');
  });

  it('nested scoped variables should be reflected in scoped form API', () => {
    const formStore = createStore<FormState<{ test: { value: string } }>>(
      () => ({
        values: { test: { value: 'initial' } },
        errors: undefined,
      })
    );

    const scopedApi = getScopedFormApi(formStore, 'test');
    expect(scopedApi.getState().touched?.value?._touched).toBeUndefined();
    formStore.setState((state) => ({
      ...state,
      touched: { test: { value: { _touched: true } } },
    }));

    expect(scopedApi.getState().touched?.value?._touched).toBe(true);
  });

  it('setting a value in the scoped form API should update the original store', () => {
    const formStore = createStore<FormState<{ test: { value: string } }>>(
      () => ({
        values: { test: { value: 'initial' } },
        errors: undefined,
      })
    );

    const scopedApi = getScopedFormApi(formStore, 'test');
    scopedApi.setState({ touched: { value: { _touched: true } } });
    expect(formStore.getState().touched?.test?.value?._touched).toBe(true);
  });
});

// Mock components for testing
const MockChild = () => {
  const store = useFormStore();
  const value = useStore(store, (state) => state.values);
  return <div data-testid="form-state">{JSON.stringify(value)}</div>;
};

describe('form.utils', () => {
  it('should create a form store with default values', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: 'Test' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const state = formStore.getState();
    expect(state.values).toEqual(defaultValues);
  });

  it('should validate form values against schema', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: '' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const state = formStore.getState();
    expect(state.errors).toBeUndefined();
  });

  it('should provide form context through FormStoreProvider', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: 'Test' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    render(
      <FormStoreProvider store={formStore}>
        <MockChild />
      </FormStoreProvider>
    );

    const formState = screen.getByTestId('form-state');
    expect(formState.textContent).toContain('"name":"Test"');
  });

  it('should create a form controller and handle changes', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: 'Test' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const MockForm = () => (
      <FormController
        store={formStore}
        name="name"
        render={({ value, onChange }) => (
          <input
            data-testid="form-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      />
    );

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    const input = screen.getByTestId('form-input') as HTMLInputElement;
    expect(input.value).toBe('Test');
  });

  it('should return default form structure', () => {
    const defaultValues = { name: 'Test' };
    const form = getDefaultForm(defaultValues);

    expect(form.values).toEqual(defaultValues);
  });

  it('should create a plain zustand store and use form controller to access it', () => {
    const defaultValues = { name: 'Plain Store Test' };
    const plainStore = createStore(
      withForm(
        () => ({
          form: getDefaultForm(defaultValues),
        }),
        {
          formPath: 'form',
          getSchema: () => z.object({ name: z.string() }),
        }
      )
    );

    const MockForm = () => {
      return (
        <FormController
          store={getFormApi(plainStore, 'form')}
          name="name"
          render={({ value, onChange }) => (
            <input
              data-testid="plain-store-input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        />
      );
    };

    render(<MockForm />);

    const input = screen.getByTestId('plain-store-input') as HTMLInputElement;
    expect(input.value).toBe('Plain Store Test');

    // Simulate user input
    fireEvent.change(input, { target: { value: 'Updated Plain Store' } });

    const state = plainStore.getState();
    expect(state.form.values.name).toBe('Updated Plain Store');
  });

  it('should be able to pass a custom form path to the Form provider', () => {
    const defaultValues = { name: 'Plain Store Test' };
    const plainStore = createStore(
      withForm(
        () => ({
          form: getDefaultForm(defaultValues),
        }),
        {
          formPath: 'form',
          getSchema: () => z.object({ name: z.string() }),
        }
      )
    );

    // create a mock component and its parent component
    const MockChild = () => {
      const store = useFormStore<{ name: string }>();

      return (
        <FormController
          store={store}
          name="name"
          render={({ value, onChange }) => (
            <input
              data-testid="plain-store-input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        />
      );
    };

    const MockParent = () => (
      <FormStoreProvider store={getFormApi(plainStore, 'form')}>
        <MockChild />
      </FormStoreProvider>
    );

    render(<MockParent />);

    const input = screen.getByTestId('plain-store-input') as HTMLInputElement;
    expect(input.value).toBe('Plain Store Test');
    // Simulate user input
    fireEvent.change(input, { target: { value: 'Updated Plain Store' } });
    const state = plainStore.getState();
    expect(state.form.values.name).toBe('Updated Plain Store');
  });

  it('should be able to pass a custom name to the form provider', () => {
    const defaultValues = { user: { name: 'Plain Store Test' } };
    const plainStore = createStore(
      withForm(
        () => ({
          form: getDefaultForm(defaultValues),
        }),
        {
          formPath: 'form',
          getSchema: () => z.object({ user: z.object({ name: z.string() }) }),
        }
      )
    );

    // create a mock component and its parent component
    const MockChild = () => {
      const store = useFormStore<{ name: string }>();
      return (
        <FormController
          store={store}
          name="name"
          render={({ value, onChange }) => (
            <input
              data-testid="plain-store-input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        />
      );
    };

    const MockParent = () => (
      <FormStoreProvider
        store={getFormApi(plainStore, 'form')}
        options={{ name: 'user' }}
      >
        <MockChild />
      </FormStoreProvider>
    );

    render(<MockParent />);

    const input = screen.getByTestId('plain-store-input') as HTMLInputElement;
    expect(input.value).toBe('Plain Store Test');
  });

  it('should handle new form state with onChange', () => {
    const defaultValues = { name: 'Initial Value', other: 'Other Value' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => z.object({ name: z.string(), other: z.string() }),
    });
    const MockForm = () => (
      <FormController
        store={formStore}
        name="name"
        render={({ value, onFormChange }) => (
          <input
            data-testid="form-input"
            value={value}
            onChange={(e) =>
              onFormChange({ name: e.target.value, other: 'Updated' })
            }
          />
        )}
      />
    );

    render(<MockForm />);

    const input = screen.getByTestId('form-input') as HTMLInputElement;
    expect(input.value).toBe('Initial Value');
    fireEvent.change(input, { target: { value: 'New Value' } });
    expect(formStore.getState().values.name).toBe('New Value');
    expect(formStore.getState().values.other).toBe('Updated');
  });
});

describe('form errors', () => {
  it('should show validation errors when form values are invalid', () => {
    const schema = z.object({
      email: z.string().email('Invalid email'),
      age: z.number().min(18, 'Must be at least 18'),
    });
    const defaultValues = { email: 'invalid-email', age: 16 };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const state = formStore.getState();
    expect(state.errors?.email?._errors).toContain('Invalid email');
    expect(state.errors?.age?._errors).toContain('Must be at least 18');
  });

  it('should clear errors when form values become valid', () => {
    const schema = z.object({
      email: z.string().email('Invalid email'),
    });
    const defaultValues = { email: 'invalid-email' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    // Initially should have errors
    expect(formStore.getState().errors?.email?._errors).toContain(
      'Invalid email'
    );

    // Update to valid value
    formStore.setState((state) => ({
      ...state,
      values: { email: 'test@example.com' },
    }));

    // Errors should be cleared
    expect(formStore.getState().errors?.email?._errors).toBeUndefined();
  });

  it('should display errors in FormController', () => {
    const schema = z.object({
      name: z.string().min(2, 'Name must be at least 2 characters'),
    });
    const defaultValues = { name: 'a' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const MockForm = () => (
      <FormController
        store={formStore}
        name="name"
        render={({ error, value, onChange }) => (
          <div>
            <input
              data-testid="form-input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
            {error?._errors && (
              <div data-testid="error-message">{error._errors[0]}</div>
            )}
          </div>
        )}
      />
    );

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    const errorMessage = screen.getByTestId('error-message');
    expect(errorMessage.textContent).toBe('Name must be at least 2 characters');
  });

  it('should handle nested object validation errors', () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          firstName: z.string().min(1, 'First name is required'),
          lastName: z.string().min(1, 'Last name is required'),
        }),
      }),
    });
    const defaultValues = {
      user: {
        profile: {
          firstName: '',
          lastName: '',
        },
      },
    };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const state = formStore.getState();
    expect(state.errors?.user?.profile?.firstName?._errors).toContain(
      'First name is required'
    );
    expect(state.errors?.user?.profile?.lastName?._errors).toContain(
      'Last name is required'
    );
  });
});

describe('form touched state', () => {
  it('should mark field as touched when onBlur is called', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: 'Test' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const MockForm = () => (
      <FormController
        store={formStore}
        name="name"
        render={({ value, onChange, onBlur, touched }) => (
          <>
            <input
              data-testid="form-input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
            />
            <div data-testid="touched-state">
              {touched?._touched ? 'Field is touched' : 'Field is not touched'}
            </div>
          </>
        )}
      />
    );

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    // Initially not touched
    expect(formStore.getState().touched?.name?._touched).toBeUndefined();

    const input = screen.getByTestId('form-input');
    fireEvent.blur(input);

    // Should be touched after blur
    expect(formStore.getState().touched?.name?._touched).toBe(true);
    const touchedState = screen.getByTestId('touched-state');
    expect(touchedState.textContent).toBe('Field is touched');
  });

  it('should mark field as touched when onChange is called', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: 'Test' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const MockForm = () => (
      <FormController
        store={formStore}
        name="name"
        render={({ value, onChange }) => (
          <input
            data-testid="form-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      />
    );

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    // Initially not touched
    expect(formStore.getState().touched?.name?._touched).toBeUndefined();

    const input = screen.getByTestId('form-input');
    fireEvent.change(input, { target: { value: 'New Value' } });

    // Should be touched after change
    expect(formStore.getState().touched?.name?._touched).toBe(true);
  });

  it('should handle touched state in nested forms', () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
      }),
    });
    const defaultValues = { user: { name: 'Test' } };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const MockForm = () => (
      <FormController
        store={getScopedFormApi(formStore, 'user')}
        name="name"
        render={({ value, onChange, onBlur }) => (
          <input
            data-testid="nested-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        )}
      />
    );

    render(<MockForm />);

    // Initially not touched
    expect(formStore.getState().touched?.user?.name?._touched).toBeUndefined();

    const input = screen.getByTestId('nested-input');
    fireEvent.blur(input);

    // Should be touched after blur
    expect(formStore.getState().touched?.user?.name?._touched).toBe(true);
  });

  it('should persist touched state when value changes', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: 'Test' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const MockForm = () => (
      <FormController
        store={formStore}
        name="name"
        render={({ value, onChange, onBlur }) => (
          <input
            data-testid="form-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        )}
      />
    );

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    const input = screen.getByTestId('form-input');

    // First blur to set touched
    fireEvent.blur(input);
    expect(formStore.getState().touched?.name?._touched).toBe(true);

    // Change value
    fireEvent.change(input, { target: { value: 'New Value' } });

    // Should still be touched
    expect(formStore.getState().touched?.name?._touched).toBe(true);
  });
});

describe('form dirty state', () => {
  it('should mark field as dirty when value changes', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: 'Test' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const MockForm = () => (
      <FormController
        store={formStore}
        name="name"
        render={({ value, onChange }) => (
          <input
            data-testid="form-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      />
    );

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    // Initially not dirty
    expect(formStore.getState().dirty?.name?._dirty).toBeUndefined();

    const input = screen.getByTestId('form-input');
    fireEvent.change(input, { target: { value: 'New Value' } });

    // Should be dirty after change
    expect(formStore.getState().dirty?.name?._dirty).toBe(true);
  });

  it('should not mark field as dirty on blur without value change', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: 'Test' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const MockForm = () => (
      <FormController
        store={formStore}
        name="name"
        render={({ value, onChange, onBlur }) => (
          <input
            data-testid="form-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        )}
      />
    );

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    // Initially not dirty
    expect(formStore.getState().dirty?.name?._dirty).toBeUndefined();

    const input = screen.getByTestId('form-input');
    fireEvent.blur(input);

    // Should still not be dirty after blur without value change
    expect(formStore.getState().dirty?.name?._dirty).toBeUndefined();
  });

  it('should handle dirty state in nested forms', () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
      }),
    });
    const defaultValues = { user: { name: 'Test' } };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const MockForm = () => (
      <FormController
        store={getScopedFormApi(formStore, 'user')}
        name="name"
        render={({ value, onChange }) => (
          <input
            data-testid="nested-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      />
    );

    render(<MockForm />);

    // Initially not dirty
    expect(formStore.getState().dirty?.user?.name?._dirty).toBeUndefined();

    const input = screen.getByTestId('nested-input');
    fireEvent.change(input, { target: { value: 'New Value' } });

    // Should be dirty after change
    expect(formStore.getState().dirty?.user?.name?._dirty).toBe(true);
  });

  it('should persist dirty state through multiple changes', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: 'Test' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const MockForm = () => (
      <FormController
        store={formStore}
        name="name"
        render={({ value, onChange }) => (
          <input
            data-testid="form-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      />
    );

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    const input = screen.getByTestId('form-input');

    // First change
    fireEvent.change(input, { target: { value: 'First Change' } });
    expect(formStore.getState().dirty?.name?._dirty).toBe(true);

    // Second change
    fireEvent.change(input, { target: { value: 'Second Change' } });
    expect(formStore.getState().dirty?.name?._dirty).toBe(true);
  });

  it('should work with functional value updates', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: 'Test' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const MockForm = () => (
      <FormController
        store={formStore}
        name="name"
        render={({ onChange }) => (
          <button
            data-testid="update-button"
            onClick={() => onChange((prev) => prev + ' Updated')}
          >
            Update
          </button>
        )}
      />
    );

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    // Initially not dirty
    expect(formStore.getState().dirty?.name?._dirty).toBeUndefined();

    const button = screen.getByTestId('update-button');
    fireEvent.click(button);

    // Should be dirty after functional update
    expect(formStore.getState().dirty?.name?._dirty).toBe(true);
    expect(formStore.getState().values.name).toBe('Test Updated');
  });
});

describe('form state integration', () => {
  it('should handle errors, touched, and dirty together', () => {
    const schema = z.object({
      email: z.string().email('Invalid email'),
    });
    const defaultValues = { email: '' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const MockForm = () => {
      const touched = useStore(
        formStore,
        (state) => state.touched?.email?._touched
      );
      const dirty = useStore(formStore, (state) => state.dirty?.email?._dirty);

      return (
        <FormController
          store={formStore}
          name="email"
          render={({ value, onChange, onBlur, error }) => {
            return (
              <div>
                <input
                  data-testid="email-input"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onBlur={onBlur}
                />
                {error?._errors && (
                  <div data-testid="error-message">{error._errors[0]}</div>
                )}
                <div data-testid="touched-state">
                  {touched ? 'touched' : 'not-touched'}
                </div>
                <div data-testid="dirty-state">
                  {dirty ? 'dirty' : 'not-dirty'}
                </div>
              </div>
            );
          }}
        />
      );
    };

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    const input = screen.getByTestId('email-input');

    // Initially should have error but not be touched or dirty
    expect(screen.getByTestId('error-message').textContent).toBe(
      'Invalid email'
    );
    expect(screen.getByTestId('touched-state').textContent).toBe('not-touched');
    expect(screen.getByTestId('dirty-state').textContent).toBe('not-dirty');

    // Type invalid email
    fireEvent.change(input, { target: { value: 'invalid' } });

    // Should still have error, now touched and dirty
    expect(screen.getByTestId('error-message').textContent).toBe(
      'Invalid email'
    );
    expect(screen.getByTestId('touched-state').textContent).toBe('touched');
    expect(screen.getByTestId('dirty-state').textContent).toBe('dirty');

    // Type valid email
    fireEvent.change(input, { target: { value: 'test@example.com' } });

    // Error should be cleared, still touched and dirty
    expect(screen.queryByTestId('error-message')).toBeNull();
    expect(screen.getByTestId('touched-state').textContent).toBe('touched');
    expect(screen.getByTestId('dirty-state').textContent).toBe('dirty');
  });

  it('should handle array validation with errors, touched, and dirty', () => {
    const schema = z.object({
      items: z.array(
        z.object({
          name: z.string().min(1, 'Name is required'),
        })
      ),
    });
    const defaultValues = { items: [{ name: '' }] };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    // Check initial state
    const state = formStore.getState();
    expect(state.errors?.items?.[0]?.name?._errors).toContain(
      'Name is required'
    );

    // Update the first item
    formStore.setState((state) => ({
      ...state,
      values: { items: [{ name: 'Valid Name' }] },
      touched: { items: { 0: { name: { _touched: true } } } },
      dirty: { items: { 0: { name: { _dirty: true } } } },
    }));

    const updatedState = formStore.getState();
    expect(updatedState.errors?.items?.[0]?.name?._errors).toBeUndefined();
    expect(updatedState.touched?.items?.[0]?.name?._touched).toBe(true);
    expect(updatedState.dirty?.items?.[0]?.name?._dirty).toBe(true);
  });

  it('should reset form state directly, including values, errors, touched, and dirty', () => {
    const schema = z.object({ name: z.string() });
    const defaultValues = { name: 'Test' };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const MockForm = () => (
      <FormController
        store={formStore}
        name="name"
        render={({ value, onChange, onBlur }) => (
          <input
            data-testid="form-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        )}
      />
    );

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    const input = screen.getByTestId('form-input');

    // Change value
    fireEvent.change(input, { target: { value: 'Updated Value' } });
    expect(formStore.getState().values.name).toBe('Updated Value');

    // Set touched and dirty
    formStore.setState((state) => ({
      ...state,
      touched: { name: { _touched: true } },
      dirty: { name: { _dirty: true } },
    }));

    expect(formStore.getState().touched?.name?._touched).toBe(true);
    expect(formStore.getState().dirty?.name?._dirty).toBe(true);

    // Reset form state
    formStore.setState((state) => ({
      ...state,
      values: defaultValues,
      errors: undefined,
      touched: undefined,
      dirty: undefined,
    }));

    // Check reset state
    expect(formStore.getState().values.name).toBe('Test');
    expect(formStore.getState().errors).toBeUndefined();
    expect(formStore.getState().touched?.name?._touched).toBeUndefined();
    expect(formStore.getState().dirty?.name?._dirty).toBeUndefined();
  });

  it('should handle form state dynamic arrays', () => {
    const schema = z.object({
      items: z.array(
        z.object({
          name: z.string().min(1, 'Name is required'),
        })
      ),
    });
    const defaultValues = { items: [{ name: '' }] };
    const formStore = createFormStore(defaultValues, {
      getSchema: () => schema,
    });

    const MockForm = () => (
      <FormController
        store={formStore}
        name="items"
        render={({ value, onChange }) => (
          <div>
            {value.map((item, index) => (
              <input
                key={index}
                data-testid={`item-input-${index}`}
                value={item.name}
                onChange={(e) =>
                  onChange(
                    value.map((v, i) =>
                      i === index ? { ...v, name: e.target.value } : v
                    )
                  )
                }
              />
            ))}
            <button
              data-testid="add-item-button"
              onClick={() => onChange([...value, { name: '' }])}
            >
              Add Item
            </button>
          </div>
        )}
      />
    );

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    const addButton = screen.getByTestId('add-item-button');
    fireEvent.click(addButton);

    const itemInputs = screen.getAllByTestId(/item-input-/);
    expect(itemInputs.length).toBe(2); // One initial + one added

    // Check initial error state
    expect(formStore.getState().errors?.items?.[0]?.name?._errors).toContain(
      'Name is required'
    );

    // Fill in the first item
    fireEvent.change(itemInputs[0], { target: { value: 'Item 1' } });
    expect(formStore.getState().values.items[0].name).toBe('Item 1');

    // Check that error is cleared for the first item
    expect(
      formStore.getState().errors?.items?.[0]?.name?._errors
    ).toBeUndefined();

    // Fill in the second item
    fireEvent.change(itemInputs[1], { target: { value: 'Item 2' } });
    expect(formStore.getState().values.items[1].name).toBe('Item 2');

    // Check that error is cleared for the second item
    expect(
      formStore.getState().errors?.items?.[1]?.name?._errors
    ).toBeUndefined();
  });

  it('should work with this example', async () => {
    type FriendsForm = {
      friends: {
        name: string;
        age: number;
        email: string;
      }[];
    };

    const useFriendsForm = create<FormState<FriendsForm>>()(
      withForm(
        () =>
          getDefaultForm<FriendsForm>({
            friends: [{ name: '', age: 0, email: '' }],
          }),
        {
          getSchema: () =>
            z.object({
              friends: z
                .array(
                  z.object({
                    name: z.string().min(1, 'Name is required'),
                    age: z.number().min(1, 'Age must be positive'),
                    email: z.string().email('Invalid email address'),
                  })
                )
                .min(1, 'At least one friend is required'),
            }),
        }
      )
    );

    function App() {
      const isValid = useFriendsForm((state) => !state.errors);
      const isDirty = useFriendsForm((state) => state.dirty);

      const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isValid) {
          const formData = useFriendsForm.getState().values;
          console.log('Form submitted:', formData);
          alert('Form submitted! Check console for data.');
        }
      };

      return (
        <div
          style={{ maxWidth: '600px', margin: '50px auto', padding: '20px' }}
        >
          <h1>Zustorm Array Example</h1>

          <form onSubmit={onSubmit}>
            <h2>Friends List</h2>

            <FormController
              store={useFriendsForm}
              name="friends"
              render={({ value, onChange }) => (
                <div>
                  {value.map((_, index) => (
                    <div
                      key={index}
                      style={{
                        marginBottom: '20px',
                        padding: '15px',
                        border: '1px solid #ccc',
                        borderRadius: '5px',
                      }}
                    >
                      <h3>Friend #{index + 1}</h3>

                      <div>
                        <FormController
                          store={useFriendsForm}
                          name={`friends.${index}.name`}
                          render={({
                            value: name,
                            onChange: onNameChange,
                            error,
                          }) => (
                            <div style={{ marginBottom: '10px' }}>
                              <label>Name:</label>
                              <input
                                data-testid={`friend-name-${index}`}
                                type="text"
                                value={name}
                                onChange={(e) => onNameChange(e.target.value)}
                                placeholder="Enter name"
                                style={{ marginLeft: '10px', padding: '5px' }}
                              />
                              {error && (
                                <div style={{ color: 'red', fontSize: '12px' }}>
                                  {JSON.stringify(error)}
                                </div>
                              )}
                            </div>
                          )}
                        />

                        <FormController
                          store={useFriendsForm}
                          name={`friends.${index}.age`}
                          render={({
                            value: age,
                            onChange: onAgeChange,
                            error,
                          }) => (
                            <div style={{ marginBottom: '10px' }}>
                              <label>Age:</label>
                              <input
                                type="number"
                                value={age}
                                onChange={(e) =>
                                  onAgeChange(Number(e.target.value))
                                }
                                placeholder="Age"
                                style={{ marginLeft: '10px', padding: '5px' }}
                              />
                              {error && (
                                <div style={{ color: 'red', fontSize: '12px' }}>
                                  {JSON.stringify(error)}
                                </div>
                              )}
                            </div>
                          )}
                        />

                        <FormController
                          store={useFriendsForm}
                          name={`friends.${index}.email`}
                          render={({
                            value: email,
                            onChange: onEmailChange,
                            error,
                          }) => (
                            <div style={{ marginBottom: '10px' }}>
                              <label>Email:</label>
                              <input
                                type="email"
                                value={email}
                                onChange={(e) => onEmailChange(e.target.value)}
                                placeholder="friend@example.com"
                                style={{ marginLeft: '10px', padding: '5px' }}
                              />
                              {error && (
                                <div style={{ color: 'red', fontSize: '12px' }}>
                                  {JSON.stringify(error)}
                                </div>
                              )}
                            </div>
                          )}
                        />
                      </div>

                      {value.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newFriends = value.filter(
                              (_, i) => i !== index
                            );
                            onChange(newFriends);
                          }}
                          style={{
                            background: 'red',
                            color: 'white',
                            padding: '5px 10px',
                            border: 'none',
                            borderRadius: '3px',
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    data-testid="add-friend-button"
                    type="button"
                    onClick={() => {
                      console.log('Adding new friend', value);
                      onChange((value) => [
                        ...value,
                        { name: '', age: 0, email: '' },
                      ]);
                    }}
                    style={{
                      background: 'green',
                      color: 'white',
                      padding: '10px 15px',
                      border: 'none',
                      borderRadius: '3px',
                      marginBottom: '20px',
                    }}
                  >
                    Add Friend
                  </button>
                </div>
              )}
            />

            <div style={{ marginTop: '20px' }}>
              <p>Form is {isValid ? 'valid' : 'invalid'}</p>
              <p>Form is {isDirty ? 'modified' : 'unchanged'}</p>

              <button
                type="submit"
                disabled={!isValid || !isDirty}
                style={{
                  background: !isValid || !isDirty ? '#ccc' : 'blue',
                  color: 'white',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: !isValid || !isDirty ? 'not-allowed' : 'pointer',
                }}
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      );
    }
    // Mock console.error to catch unhandled errors
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(<App />);

    // give initial person a name
    const firstNameInput = screen.getByTestId('friend-name-0');
    fireEvent.change(firstNameInput, { target: { value: 'John Doe' } });

    // add a second person - this should trigger an Immer error
    const addButton = screen.getByTestId('add-friend-button');

    // The error will be thrown during the fireEvent.click but caught by React
    fireEvent.click(addButton);

    // Wait for any async operations
    await new Promise((resolve) => setTimeout(resolve, 0));

    // make sure the error was not logged to the console
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();

    // make sure that the form is touched for each level of the form to that point
    // expect(useFriendsForm.getState().touched?._touched).toBe(true);
    // expect(useFriendsForm.getState().touched?.friends?._touched).toBe(true);
    expect(
      useFriendsForm.getState().touched?.friends?.[0]?.name?._touched
    ).toBe(true);
  });
});

describe('contextSelector', () => {
  it('should return correct value with contextSelector', () => {
    const defaultValues = { user: { name: 'John', age: 30 } };
    const formStore = createFormStore(defaultValues, {
      getSchema: () =>
        z.object({
          user: z.object({
            name: z.string(),
            age: z.number(),
          }),
        }),
    });

    const MockForm = () => (
      <FormController
        store={formStore}
        contextSelector={(state) => state.user}
        render={({ context }) => (
          <div>
            <div data-testid="user-name">{context.name}</div>
            <div data-testid="user-age">{context.age}</div>
          </div>
        )}
      />
    );

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    expect(screen.getByTestId('user-name').textContent).toBe('John');
    expect(screen.getByTestId('user-age').textContent).toBe('30');

    act(() => {
      // Update the form value
      formStore.setState((state) => ({
        ...state,
        values: { user: { name: 'Jane', age: 25 } },
      }));
    });
    expect(screen.getByTestId('user-name').textContent).toBe('Jane');
    expect(screen.getByTestId('user-age').textContent).toBe('25');
  });

  it('should work within form provider with contextSelector', () => {
    const defaultValues = { user: { name: 'John', age: 30 } };
    const formStore = createFormStore(defaultValues, {
      getSchema: () =>
        z.object({
          user: z.object({
            name: z.string(),
            age: z.number(),
          }),
        }),
    });

    const MockForm = () => {
      const store = useFormStore<{
        user: { name: string; age: number };
      }>();
      return (
        <FormController
          store={store}
          contextSelector={(state) => state.user}
          render={({ context }) => (
            <div>
              <div data-testid="user-name">{context.name}</div>
              <div data-testid="user-age">{context.age}</div>
            </div>
          )}
        />
      );
    };

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    expect(screen.getByTestId('user-name').textContent).toBe('John');
    expect(screen.getByTestId('user-age').textContent).toBe('30');

    act(() => {
      // Update the form value
      formStore.setState((state) => ({
        ...state,
        values: { user: { name: 'Jane', age: 25 } },
      }));
    });
    expect(screen.getByTestId('user-name').textContent).toBe('Jane');
    expect(screen.getByTestId('user-age').textContent).toBe('25');
  });

  it('should handle contextSelector with a named form controller', () => {
    const defaultValues = { user: { name: 'John', age: 30 } };
    const formStore = createFormStore(defaultValues, {
      getSchema: () =>
        z.object({
          user: z.object({
            name: z.string(),
            age: z.number(),
          }),
        }),
    });

    const MockForm = () => (
      <FormController
        store={formStore}
        name="user"
        contextSelector={(state) => state.user}
        render={({ context }) => (
          <div>
            <div data-testid="user-name">{context.name}</div>
            <div data-testid="user-age">{context.age}</div>
          </div>
        )}
      />
    );

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    expect(screen.getByTestId('user-name').textContent).toBe('John');
    expect(screen.getByTestId('user-age').textContent).toBe('30');

    act(() => {
      // Update the form value
      formStore.setState((state) => ({
        ...state,
        values: { user: { name: 'Jane', age: 25 } },
      }));
    });
    expect(screen.getByTestId('user-name').textContent).toBe('Jane');
    expect(screen.getByTestId('user-age').textContent).toBe('25');
  });
});

describe('deepkey tuples', () => {
  it('should handle deep key tuples', () => {
    const defaultValues = {
      user: {
        profile: {
          firstName: 'John',
          lastName: 'Doe',
        },
      },
    };
    const formStore = createFormStore(defaultValues, {
      getSchema: () =>
        z.object({
          user: z.object({
            profile: z.object({
              firstName: z.string(),
              lastName: z.string(),
            }),
          }),
        }),
    });

    const MockForm = () => (
      <div>
        <FormController
          store={formStore}
          name={['user', 'profile', 'firstName']}
          render={({ value, onChange }) => (
            <div>
              <input value={value} onChange={(e) => onChange(e.target.value)} />
              <div data-testid="first-name">{value}</div>
            </div>
          )}
        />
        <FormController
          store={formStore}
          name={['user', 'profile', 'lastName']}
          render={({ value, onChange }) => (
            <div>
              <input value={value} onChange={(e) => onChange(e.target.value)} />
              <div data-testid="last-name">{value}</div>
            </div>
          )}
        />
      </div>
    );

    render(<MockForm />);

    expect(screen.getByTestId('first-name').textContent).toBe('John');
    expect(screen.getByTestId('last-name').textContent).toBe('Doe');

    act(() => {
      formStore.setState((state) => ({
        ...state,
        values: {
          user: {
            profile: {
              firstName: 'Jane',
              lastName: 'Smith',
            },
          },
        },
      }));
    });

    expect(screen.getByTestId('first-name').textContent).toBe('Jane');
    expect(screen.getByTestId('last-name').textContent).toBe('Smith');
  });
});

describe('should allow custom FormController', () => {
  it('should allow custom FormController with custom render prop', () => {
    const CustomFormController = <
      S,
      C,
      const K extends DeepKeys<S> | undefined
    >(
      props: Omit<FormControllerProps<S, C, K>, 'render'> & {
        title: string;
        render: (
          props: FormRenderProps<S, C, K> & { id: string }
        ) => JSX.Element;
      }
    ) => {
      return (
        <FormController
          {...props}
          render={(renderProps) => {
            const errors: string[] = renderProps?.error?._errors || [];
            const touched = renderProps?.touched || false;
            const id = 'test';

            return (
              <div className="field">
                <label
                  data-testid={`title-${id}`}
                  className="field-label"
                  htmlFor={id}
                >
                  {props.title}
                </label>
                <div className="field-input">
                  {props.render({ ...renderProps, id })}
                </div>
                {touched && errors.length > 0 && (
                  <ul className="field-errors">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }}
        />
      );
    };

    const defaultValues = { user: { name: 'John', age: 30 } };
    const formStore = createFormStore(defaultValues, {
      getSchema: () =>
        z.object({
          user: z.object({
            name: z.string(),
            age: z.number(),
          }),
        }),
    });

    const MockForm = () => (
      <CustomFormController
        store={formStore}
        name="user.name"
        title="User Name"
        render={({ value, onChange, id }) => (
          <input
            data-testid={`custom-input-${id}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      />
    );

    render(
      <FormStoreProvider store={formStore}>
        <MockForm />
      </FormStoreProvider>
    );

    const input = screen.getByTestId('custom-input-test') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe('John');

    expect(screen.getByTestId('title-test').textContent).toBe('User Name');

    fireEvent.change(input, { target: { value: 'Jane' } });
    expect(input.value).toBe('Jane');
    expect(formStore.getState().values.user.name).toBe('Jane');
  });
});
