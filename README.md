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
- **Built-in Validation** - Seamless Zod schema integration
- **High Performance** - Granular updates and minimal re-renders
- **Flexible Architecture** - Global stores or React Context patterns
- **Zero Dependencies** - Only peer deps: Zustand, Zod, and React

## Installation

```bash
npm install zustorm zustand zod react
```

## Quick Start

```typescript
import { z } from 'zod';
import { create } from 'zustand';
import { withForm, getDefaultForm, FormController } from 'zustorm';

type UserForm = {
  name: string;
  email: string;
};

const useUserForm = create(
  withForm(() => getDefaultForm<UserForm>({ name: '', email: '' }), {
    getSchema: () =>
      z.object({
        name: z.string().min(1, 'Name required'),
        email: z.string().email('Invalid email'),
      }),
  })
);

function UserForm() {
  const isValid = useUserForm((state) => !state.errors);
  const isDirty = useUserForm((state) => state.dirty);

  return (
    <form>
      <FormController
        store={useUserForm}
        name="name"
        render={({ value, onChange, error }) => (
          <input value={value} onChange={(e) => onChange(e.target.value)} />
        )}
      />
      <FormController
        store={useUserForm}
        name="email"
        render={({ value, onChange, error }) => (
          <input value={value} onChange={(e) => onChange(e.target.value)} />
        )}
      />
      <button disabled={!isValid || !isDirty}>Submit</button>
    </form>
  );
}
```

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

| Function                      | Description                                    |
| ----------------------------- | ---------------------------------------------- |
| `withForm(creator, options)`  | Enhances Zustand store with form capabilities  |
| `FormController`              | Renders form fields with state binding         |
| `FormStoreProvider`           | Provides form store context                    |
| `useFormStore()`              | Access form store from context                 |
| `getDefaultForm(values)`      | Returns default form state                     |
| `getFormApi(store, formPath)` | Access deep form API methods                   |
| `createFormStoreProvider()`   | Creates a FormStoreProvider component and hook |

## Examples

Complete examples with styling and advanced features:

- [Global Store Example](https://github.com/mooalot/zustorm/tree/main/examples/global)
- [Context Example](https://github.com/mooalot/zustorm/tree/main/examples/context)
- [Array Handling Example](https://github.com/mooalot/zustorm/tree/main/examples/arrays)

## TypeScript Compatibility

This package's type definitions require **TypeScript 5.0 or higher** due to the use of `const` type parameters and other advanced type features.

Make sure you're using TypeScript 5.0+ to take full advantage of type safety and autocomplete.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see the [LICENSE](LICENSE) file for details.
