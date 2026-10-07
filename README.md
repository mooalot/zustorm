<img src="./zustorm-art.jpg" alt="Zustorm Logo" style="max-width: 1000px; width: 100%; display: block; margin: 0 auto 20px auto;">

[![npm version](https://img.shields.io/npm/v/zustorm?color=06172C&labelColor=000000&style=flat-square)](https://badge.fury.io/js/zustorm)
[![CI](https://img.shields.io/github/actions/workflow/status/mooalot/zustorm/publish.yml?color=06172C&labelColor=000000&style=flat-square&label=CI)](https://github.com/mooalot/zustorm/actions)
[![Test Coverage](https://img.shields.io/badge/coverage-100%25-06172C?labelColor=000000&style=flat-square)](https://github.com/mooalot/zustorm)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-06172C?labelColor=000000&style=flat-square)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-06172C?labelColor=000000&style=flat-square)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/zustorm?color=06172C&labelColor=000000&style=flat-square)](https://www.npmjs.com/package/zustorm)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/zustorm?color=06172C&labelColor=000000&style=flat-square)](https://bundlephobia.com/package/zustorm)

**Powerful form management with Zustand and Zod validation**

Zustorm combines the simplicity of Zustand with the power of Zod validation to create a type-safe, intuitive form management solution for React applications.

## Features

- **Simple & Intuitive** - Familiar Zustand patterns for form state
- **Type Safe** - Full TypeScript support with automatic type inference
- **Bring Your Own Validation** - Zod, Valibot, ArkType or any [Standard Schema](https://standardschema.dev) library, or a plain function
- **High Performance** - Granular updates and minimal re-renders
- **Flexible Architecture** - Global stores or React Context patterns
- **Tiny** - About 6 kB gzipped; peer deps are Zustand and React, and a schema library is optional

## Installation

```bash
npm install zustorm zustand react
```

Add the schema library you prefer, for example `npm install zod` or `npm install valibot`. The examples below use Zod.

## Quick Start

```typescript
import { z } from 'zod';
import { create } from 'zustand';
import { withForm, FormController } from 'zustorm';

type UserForm = {
  name: string;
  email: string;
};

const useUserForm = create(
  withForm<UserForm>(
    { name: '', email: '' },
    {
      getSchema: () =>
        z.object({
          name: z.string().min(1, 'Name required'),
          email: z.string().email('Invalid email'),
        }),
    }
  )
);

function UserForm() {
  const isValid = useUserForm((state) => state.isValid);
  const isDirty = useUserForm((state) => state.isDirty);
  const handleSubmit = useUserForm((state) => state.handleSubmit);

  return (
    <form onSubmit={handleSubmit((values) => console.log(values))}>
      <FormController
        store={useUserForm}
        name="name"
        render={({ value, onChange, onBlur, errorMessage, isTouched }) => (
          <>
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
            />
            {isTouched && errorMessage}
          </>
        )}
      />
      <FormController
        store={useUserForm}
        name="email"
        render={({ value, onChange, errorMessage }) => (
          <>
            <input value={value} onChange={(e) => onChange(e.target.value)} />
            {errorMessage}
          </>
        )}
      />
      <button disabled={!isValid || !isDirty}>Submit</button>
    </form>
  );
}
```

### Creating a Store

`withForm` is a Zustand middleware. Give it the initial values and it builds the whole form state for you:

```typescript
const useUserForm = create(withForm({ name: '', email: '' }, { getSchema }));
```

To keep other state next to the form, pass a creator instead. It returns `{ values }` plus whatever else you need, and the store type is inferred from it:

```typescript
const useUserForm = create(
  withForm(() => ({ values: { name: '', email: '' }, submitCount: 0 }), {
    getSchema,
  })
);
```

When the creator uses `set` or `get`, or the form lives inside a bigger store, use Zustand's curried `create<State>()` so the store type comes from the annotation, and point `withForm` at the form with `formPath`:

```typescript
type AppState = {
  form: FormState<UserForm>;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
};

const useAppStore = create<AppState>()(
  withForm(
    (set) => ({
      form: { values: { name: '', email: '' } },
      theme: 'light',
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
    }),
    { formPath: 'form', getSchema }
  )
);
```

Pass `getFormApi(useAppStore, 'form')` to `FormController` and `FormStoreProvider` to work with the nested form. `getDefaultForm(values)` from earlier versions still works but is deprecated: pass the values to `withForm` instead.

### Validation

`getSchema` returns anything that implements [Standard Schema](https://standardschema.dev): Zod 3.24+, Zod 4, Valibot, ArkType, Effect Schema and others. The errors tree, flags and messages are the same whichever library produced them.

```typescript
import * as v from 'valibot';

const useUserForm = create(
  withForm<UserForm>(
    { name: '', email: '' },
    {
      getSchema: () =>
        v.object({
          name: v.pipe(v.string(), v.minLength(1, 'Name required')),
          email: v.pipe(v.string(), v.email('Invalid email')),
        }),
    }
  )
);
```

For rules that are not a schema, `createSchema` wraps a function that returns the issues it finds. Each issue has a `message` and an optional `path`, as a dotted string or an array of keys; leave the path out for a form-level error. This is the hook for JSON Schema validators such as Ajv, cross-field rules, or errors a server sent back:

```typescript
import { createSchema } from 'zustorm';

const schema = createSchema<Booking>((values) => {
  const issues = [];
  if (values.start > values.end)
    issues.push({ message: 'Start must be before end' });
  if (!values.guests.length)
    issues.push({ path: 'guests', message: 'Add a guest' });
  return issues;
});

// With Ajv (or any validator that reports a path and a message):
const schema = createSchema<Booking>((values) =>
  validate(values)
    ? []
    : validate.errors!.map((error) => ({
        path: error.instancePath.split('/').filter(Boolean),
        message: error.message ?? 'Invalid',
      }))
);
```

`getSchema` receives the whole store state, so the schema can depend on other state. Validation is synchronous; a schema with async rules is rejected with an error rather than treated as valid.

### Zustand Middleware

A form store is an ordinary Zustand store, so Zustand's middlewares compose with `withForm`. Wrap it in `devtools` to inspect every edit, or in `persist` to keep a draft across reloads:

```typescript
import { devtools, persist } from 'zustand/middleware';

const useUserForm = create<FormState<UserForm>>()(
  devtools(
    persist(withForm<UserForm>({ name: '', email: '' }, { getSchema }), {
      name: 'user-form',
      partialize: ({ values }) => ({ values }),
    }),
    { name: 'user-form' }
  )
);
```

State written by a middleware, such as a restored draft or a devtools time-travel step, is adopted as it is: errors and flags are recomputed from it, but the restored values are not marked touched or dirty. Persist `initialValues`, `touched` and `dirty` alongside `values` if you want those restored as well.

### Using the Hook

`useFormController` gives you everything the `FormController` render prop receives, for cases where a hook reads better than a render prop:

```typescript
import { useFormController } from 'zustorm';

function NameField() {
  const { value, onChange, onBlur, errorMessage, isTouched } = useFormController(
    useUserForm,
    'name'
  );

  return (
    <>
      <input value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      {isTouched && errorMessage}
    </>
  );
}
```

Leave out `name` to work with the whole form. A third argument takes `contextSelector` and `useStore`, the same options `FormController` accepts:

```typescript
const { value, context, handleSubmit } = useFormController(
  useUserForm,
  undefined,
  {
    contextSelector: (values) => values.name,
  }
);
```

Because it is a hook, call it at the top level of a component. For a dynamic list, render one small component per item or use `FormController` inline.

### Using Form Provider

```typescript
import { useMemo } from 'react';
import { FormStoreProvider, useFormStore, FormController } from 'zustorm';

function App() {
  ...
  return (
    <FormStoreProvider store={store}>
      <UserForm />
    </FormStoreProvider>
  );
}

function UserForm() {
  const store = useFormStore();
  return (
    <FormController
      store={store}
      name="name"
      render={({ value, onChange }) => (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    />
  );
}
```

`FormStoreProvider` also takes in an optional `options.name` to scope the form.

### Dynamic Arrays

```typescript
<FormController
  name="friends"
  render={({ value, onChange }) => (
    <div>
      {value.map((_, index) => (
        <FormController
          key={index}
          store={store}
          name={`friends.${index}.name`}
          render={({ value, onChange }) => (
            <input value={value} onChange={(e) => onChange(e.target.value)} />
          )}
        />
      ))}
      <button onClick={() => onChange([...value, { name: '' }])}>
        Add Friend
      </button>
    </div>
  )}
/>
```

### FormController ContextSelector

The `FormController` also has a `contextSelector` prop to access the form store values. This is useful for accessing the form state without needing to cause re-renders for every field.

```typescript
<FormController
  store={store}
  name="email"
  contextSelector={(values) => values.name}
  render={({ value, onChange, error, context }) => (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Hello ${context}`}
    />
  )}
/>
```

Please note that `contextSelector` uses `options.useStore` internally, so this can be optimized further if needed.

⚠️ **Important**: When using `contextSelector`, ensure the selected context value is stable to avoid unnecessary re-renders (or "Maximum update depth exceeded" errors in Zustand v5). Use stable selector functions or pass `useStoreWithEqualityFn` into the `options` prop of `FormController`.

### Form State, Flags and Actions

`withForm` keeps the form data and attaches derived flags and actions to the form object (at `formPath` when one is given):

| Key                                 | Description                                                              |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `values`                            | Current values                                                           |
| `initialValues`                     | Baseline that `reset()` returns to                                       |
| `errors`, `touched`, `dirty`        | Nested trees mirroring the values (`_errors`, `_touched`, `_dirty`)      |
| `isValid`, `isDirty`, `isTouched`   | Derived booleans, handy for selectors and submit buttons                 |
| `reset(values?, options?)`          | Restore `initialValues` (or the supplied values) and clear touched/dirty |
| `resetTouched()`, `resetDirty()`    | Clear only that state                                                    |
| `resetErrors()`                     | Clear errors until the next value change or `validate()`                 |
| `touchAll()`                        | Mark every field as touched, for example to show all errors              |
| `validate()`                        | Re-run the schema, write the errors and return validity                  |
| `setErrors(errors)`                 | Replace the errors, for example with errors a server returned            |
| `setError(path, message)`           | Set one field's messages, keeping the rest; `setError(message)` for root |
| `isSubmitting`                      | True while a `handleSubmit` callback is running                          |
| `handleSubmit(onValid, onInvalid?)` | Build an `onSubmit` handler that touches all, validates and calls back   |

#### Reading errors

`errors`, `touched` and `dirty` mirror the shape of your values, with `_errors`, `_touched` and `_dirty` at every level. That is precise but verbose, so controllers and the hook also give you the flat view:

| Render prop                       | Description                                                         |
| --------------------------------- | ------------------------------------------------------------------- |
| `errorMessage`                    | First message for this field or anything below it, else `undefined` |
| `errorMessages`                   | Every message for this field and the fields below it                |
| `isTouched`, `isDirty`, `isValid` | Flags for this field and the fields below it                        |
| `isSubmitting`                    | True while the form is being submitted                              |
| `setErrors`, `setError`           | Write errors for this field or the fields below it                  |
| `error`, `touched`, `dirty`       | The raw nested trees, when you need the structure                   |

```typescript
<FormController
  store={store}
  name="user"
  render={({ errorMessages, isTouched }) => (
    <ul>{isTouched && errorMessages.map((message) => <li key={message}>{message}</li>)}</ul>
  )}
/>
```

The same views are available for any error tree, for example in a selector:

```typescript
import { getErrorMessage, getErrorMessages } from 'zustorm';

const firstError = useStore(store, (state) => getErrorMessage(state.errors));
const emailError = useStore(store, (state) =>
  getErrorMessage(state.errors?.email)
);
```

#### Resetting

`reset()` recomputes errors from the schema, exactly like a freshly created store, so a required field is reported as invalid again but is not shown as touched. The fields a reset restores are not marked as dirty.

`reset(values)` makes the supplied values the new `initialValues`, so a later `reset()` returns to them. This suits the common "load from the server, edit, reset" flow. Pass `{ keepInitialValues: true }` to restore the supplied values without moving the baseline.

```typescript
store.getState().reset(serverData); // serverData is now the baseline
store.getState().reset(); // back to serverData
store.getState().reset(draft, { keepInitialValues: true }); // baseline unchanged
```

Every action is also available from `FormController` render props and `useFormController`, scoped to the controller's `name`. A controller scoped to a field resets or touches that field only, and parent `_dirty`/`_touched` flags are pruned when no descendant is still flagged:

```typescript
<FormController
  store={store}
  name="name"
  render={({ value, onChange, reset, resetTouched, isDirty }) => (
    <>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
      <button type="button" disabled={!isDirty} onClick={() => reset()}>
        Reset to initial value
      </button>
      <button type="button" onClick={resetTouched}>
        Clear touched state
      </button>
    </>
  )}
/>
```

Submitting a form:

```typescript
const handleSubmit = useStore(store, (state) => state.handleSubmit);

<form
  onSubmit={handleSubmit(
    async (values) => await save(values),
    (errors) => console.warn(errors)
  )}
>
```

The handler calls `event.preventDefault()`, marks every field as touched so all errors become visible, validates, and then calls `onValid` with the values or `onInvalid` with the errors.

`isSubmitting` is true from the moment the handler runs until the callback settles, so a submit button can be disabled while an async save is in flight:

```typescript
const isSubmitting = useStore(store, (state) => state.isSubmitting);

<button type="submit" disabled={isSubmitting}>
  {isSubmitting ? 'Saving…' : 'Save'}
</button>
```

#### Server errors

When the server rejects a submission, write its errors into the form. `setError` sets the messages of one field and keeps every other error; with a single argument it sets a message on the form (or the controller's field) itself. `setErrors` replaces the whole tree. Either holds until the field is edited again or `validate()` runs, at which point the schema takes over.

```typescript
const onSubmit = handleSubmit(async (values) => {
  const response = await save(values);
  if (response.status === 409) {
    store.getState().setError('email', 'This email is already registered');
  }
});

// From a controller, no path needed:
<FormController
  store={store}
  name="email"
  render={({ value, onChange, errorMessage, setError }) => ...}
/>

// A whole tree, in the same shape as `errors`:
store.getState().setErrors({
  _errors: ['Please review the highlighted fields'],
  email: { _errors: ['Already registered'] },
});
```

Equivalent standalone helpers are exported for use with a store reference:

```typescript
import {
  resetForm,
  resetTouched,
  setError,
  touchAll,
  validateForm,
  handleSubmit,
} from 'zustorm';

resetForm(store);
resetTouched(store);
touchAll(store);
setError(store, 'email', 'Already registered');
const valid = validateForm(store);
const onSubmit = handleSubmit(store, (values) => save(values));
```

### Using Form Store Directly

You can also use the form store directly without the `FormController` for granular control over rendering and state management. This is not recommended for most cases, but can be useful for advanced scenarios.

```typescript
import { useFormStore } from 'zustorm';
import { useEffect } from 'react';
import { useStore } from 'zustand';

function UserForm() {
  const store = useFormStore();

  const name = useStore(store, (state) => state.values.name);
  const updateName = (newName: string) => {
    store.setState((state) => ({
      ...state,
      values: { ...state.values, name: newName },
    }));
  };

  return (
    <div>
      <input value={name} onChange={(e) => updateName(e.target.value)} />
      <button type="submit">Submit</button>
    </div>
  );
}
```

## Performance

Typing into a field re-renders that field's controller and nothing else: scoped state keeps its identity until one of its slices changes, the computer diffs by reference and validates once per update, and unchanged error subtrees keep their identity. A test in `bench/renders.test.tsx` guards this.

`npm run bench` runs a side-by-side benchmark against react-hook-form (its uncontrolled `register` path and its `Controller` path) for mounting, typing with and without a Zod schema, typing while a header subscribes to `isValid`/`isDirty`, and submitting, at 20, 100 and 500 fields. Zustorm mounts faster than both and types as fast as react-hook-form's `Controller`, the fair comparison for a controlled form; `register` stays faster per keystroke because uncontrolled inputs skip React entirely, which is a trade zustorm deliberately does not make: the store is the single source of truth. Submitting is where zustorm pays for its semantics: `handleSubmit` touches every field so all errors become visible, which re-renders each controller once, so a 100-field submit costs about 1.5 ms against react-hook-form's 0.4 ms. That is a once-per-submit cost, not a per-keystroke one.

All state updates are immutable and structurally shared, with no immer or lodash in the bundle. Updater functions receive the current value and must return a new one; mutating it in place is not supported.

Zustorm allows all the flexiblity of Zustand's performance optimizations. This means you can use `useStore` or `useStoreWithEqualityFn` or any other hook you'd like to optimize your form state access.

Here is how it is done with the FormController:

```typescript
<FormController
  ...
  options={{
    useStore: (api, selector) =>
      useStoreWithEqualityFn(api, selector, (a, b) => a === b),
  }}
/>
```

## API

| Function                                    | Description                                                          |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `withForm(valuesOrCreator, options?)`       | Zustand middleware that adds form state, flags and actions           |
| `FormController`                            | Renders form fields with state binding                               |
| `FormStoreProvider`                         | Provides form store context                                          |
| `useFormStore()`                            | Access form store from context                                       |
| `getDefaultForm(values)`                    | Deprecated, pass the values to `withForm` instead                    |
| `getFormApi(store, formPath)`               | Access deep form API methods                                         |
| `getScopedFormApi(store, name)`             | Form store scoped to a field: slices, flags and actions at that path |
| `createFormStoreProvider()`                 | Creates a FormStoreProvider component and hook                       |
| `useFormController(store, name?, options?)` | Hook form of `FormController`                                        |
| `resetForm(store, values?, options?)`       | Reset a form store to initial or given values                        |
| `resetTouched(store)`                       | Clear all touched state                                              |
| `resetDirty(store)`                         | Clear all dirty state                                                |
| `resetErrors(store)`                        | Clear errors until the next value change                             |
| `setErrors(store, errors)`                  | Replace the errors of a form store                                   |
| `setError(store, path?, message)`           | Set one field's messages, or the form's with no path                 |
| `touchAll(store)`                           | Mark every field as touched                                          |
| `validateForm(store)`                       | Re-run validation and return validity                                |
| `handleSubmit(store, onValid, onInvalid?)`  | Build a form submit handler                                          |
| `formatIssues(issues)`                      | Turn schema issues into the nested errors tree                       |
| `getErrorMessage(errors)`                   | First message in an errors tree, or undefined                        |
| `getErrorMessages(errors)`                  | Every message in an errors tree                                      |
| `createSchema(validate)`                    | Wrap a validation function as a schema `getSchema` can return        |

## Examples

Complete examples with styling and advanced features:

- [Global Store Example](https://github.com/mooalot/zustorm/tree/main/examples/global)
- [Context Example](https://github.com/mooalot/zustorm/tree/main/examples/context)
- [Array Handling Example](https://github.com/mooalot/zustorm/tree/main/examples/arrays)

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes and migration steps.

## TypeScript Compatibility

This package's type definitions require **TypeScript 5.4 or higher** due to the use of `const` type parameters, `NoInfer` and other advanced type features.

Make sure you're using TypeScript 5.4+ to take full advantage of type safety and autocomplete.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see the [LICENSE](LICENSE) file for details.
