# Zustorm

[![npm version](https://badge.fury.io/js/zustorm.svg)](https://badge.fury.io/js/zustorm)
[![Build Status](https://github.com/mooalot/zustorm/workflows/CI/badge.svg)](https://github.com/mooalot/zustorm/actions)
[![Test Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/mooalot/zustorm)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/zustorm.svg)](https://www.npmjs.com/package/zustorm)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/zustorm)](https://bundlephobia.com/package/zustorm)

<div style="display: flex; justify-content: center; align-items: center; margin-bottom: 20px; background-color: #000000; padding: 20px; border-radius: 10px;">
<img src="./zustorm-art.jpg" alt="Zustorm Logo" style="width: 100%; max-width: 600px; height: auto; display: block; margin: 0 auto; height: 100px; object-fit: cover;">
</div>

**Powerful form management with Zustand and Zod validation**

Zustorm combines the simplicity of Zustand with the power of Zod validation to create a type-safe, intuitive form management solution for React applications.

## ✨ Features

- **🎯 Simple & Intuitive** - Familiar Zustand patterns for form state
- **🔒 Type Safe** - Full TypeScript support with automatic type inference
- **✅ Built-in Validation** - Seamless Zod schema integration
- **⚡ High Performance** - Granular updates and minimal re-renders
- **🧩 Flexible Architecture** - Global stores or React Context patterns
- **📦 Zero Dependencies** - Only peer deps: Zustand, Zod, and React

## 📦 Installation

```bash
npm install zustorm zustand zod react
```

## 🚀 Quick Start

### 🌐 Global State Pattern

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
  const { isValid, isDirty } = useUserForm();

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

### 🔗 Context Pattern

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

### 🔄 Arrays

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

## 📚 API

| Function                           | Description                                   |
| ---------------------------------- | --------------------------------------------- |
| `withForm(creator, options)`       | Enhances Zustand store with form capabilities |
| `createFormStore(values, options)` | Creates standalone form store                 |
| `FormController`                   | Renders form fields with state binding        |
| `FormStoreProvider`                | Provides form store context                   |
| `useFormStore()`                   | Access form store from context                |
| `getDefaultForm(values)`           | Returns default form state                    |
| `getFormApi(store)`                | Access deep form API methods                  |

## 🎯 Key Features

- **Type Safe** - Full TypeScript inference
- **Zod Validation** - Automatic real-time validation
- **Nested Data** - Use dot notation: `user.address.street`
- **Arrays** - Dynamic arrays: `friends.${index}.name`
- **Two Patterns** - Global state or React Context

## 📖 Examples

Complete examples with styling and advanced features:

- [Global Store Example](https://github.com/mooalot/zustorm/tree/main/examples/global)
- [Context Example](https://github.com/mooalot/zustorm/tree/main/examples/context)
- [Array Handling Example](https://github.com/mooalot/zustorm/tree/main/examples/arrays)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.
