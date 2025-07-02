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

### Global State Pattern

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
  const isDirty = useUserForm((state) => state.isDirty);

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

### Context Pattern

```typescript
import { useMemo } from 'react';
import {
  createFormStore,
  FormStoreProvider,
  useFormStore,
  FormController,
} from 'zustorm';

function App() {
  const store = useMemo(
    () =>
      createFormStore(
        { name: '', email: '' },
        {
          getSchema: () =>
            z.object({
              /* ... */
            }),
        }
      ),
    []
  );

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
      name="name"
      render={({ value, onChange }) => (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    />
  );
}
```

### Arrays

```typescript
<FormController
  name="friends"
  render={({ value, onChange }) => (
    <div>
      {value.map((_, index) => (
        <FormController
          key={index}
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

### Modifying Form with setState

```typescript
import { useFormStore } from 'zustorm';
import { useEffect } from 'react';
function UserForm() {
  const store = useFormStore();

  const name = useFormStore((state) => state.values.name);
  const updateName = (newName: string) => {
    store.setState((state) => ({
      ...state,
      values: { ...state.values, name: newName },
    }));
  };

  return (
    <form>
      <input value={name} onChange={(e) => updateName(e.target.value)} />
      <button type="submit">Submit</button>
    </form>
  );
}
```

## API

| Function                           | Description                                   |
| ---------------------------------- | --------------------------------------------- |
| `withForm(creator, options)`       | Enhances Zustand store with form capabilities |
| `createFormStore(values, options)` | Creates standalone form store                 |
| `FormController`                   | Renders form fields with state binding        |
| `FormStoreProvider`                | Provides form store context                   |
| `useFormStore()`                   | Access form store from context                |
| `getDefaultForm(values)`           | Returns default form state                    |
| `getFormApi(store, formPath)`      | Access deep form API methods                  |

## Key Features

- **Type Safe** - Full TypeScript inference
- **Zod Validation** - Automatic real-time validation
- **Nested Data** - Use dot notation: `user.address.street`
- **Arrays** - Dynamic arrays: `friends.${index}.name`
- **Two Patterns** - Global state or React Context

## Examples

Complete examples with styling and advanced features:

- [Global Store Example](https://github.com/mooalot/zustorm/tree/main/examples/global)
- [Context Example](https://github.com/mooalot/zustorm/tree/main/examples/context)
- [Array Handling Example](https://github.com/mooalot/zustorm/tree/main/examples/arrays)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see the [LICENSE](LICENSE) file for details.
