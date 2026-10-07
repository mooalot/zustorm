# Changelog

## 2.0.0

### Breaking changes

- `createFormStore` is removed. Pass the initial values to `withForm` instead:

  ```ts
  // before
  const store = createFormStore(values, { getSchema });
  // after
  const store = createStore(withForm(values, { getSchema }));
  ```

- TypeScript 5.4 or newer is required (the type definitions use `NoInfer`).
- Validation goes through [Standard Schema](https://standardschema.dev). Zod still works unchanged but must be 3.24 or newer; it is now an optional peer dependency.
- Setting values on the store directly (for example `store.setState({ values })`) now marks the changed fields as dirty and touched, like a controller edit does. Use `reset(values)` to load values without flagging them.
- Field paths into optional objects now resolve to `T | undefined` rather than being rejected, and values such as `Date`, `File`, `Map`, `Set` and functions are treated as leaves. A path like `when.getTime` that previously type-checked no longer does.

### Added

- Form actions on the store and on every controller: `reset(values?, options?)`, `resetTouched()`, `resetDirty()`, `resetErrors()`, `touchAll()`, `validate()` and `handleSubmit(onValid, onInvalid?)`. `reset(values)` makes the supplied values the new baseline; pass `{ keepInitialValues: true }` to keep the old one. A controller scoped to a field resets or touches only that field.
- Derived flags `isValid`, `isDirty` and `isTouched` on the form and on every controller, and `isSubmitting`, true while a `handleSubmit` callback runs.
- `setErrors(errors)` and `setError(path, message)` on the form and every controller, plus standalone `setErrors(store, ...)` and `setError(store, ...)`, for errors a server returned or rules checked elsewhere. They hold until the field is edited or `validate()` runs.
- Flat error access on controllers: `errorMessage` and `errorMessages`, plus the `getErrorMessage`, `getErrorMessages` and `formatIssues` helpers for use in selectors.
- `useFormController(store, name?, options?)`, the hook form of `FormController`.
- `getScopedFormApi(store, name)`, a form store scoped to a field with its own slices, flags and actions.
- `withForm` accepts the initial values directly, a creator returning `{ values, ...extra }` with the store type inferred, or a curried `create<State>()` creator using `set` and `get`, at the root or at `formPath`.
- Standalone helpers that take a store reference: `resetForm`, `resetTouched`, `resetDirty`, `resetErrors`, `touchAll`, `validateForm` and `handleSubmit`.
- Any Standard Schema library can validate a form: Zod 3.24+, Zod 4, Valibot, ArkType, Effect Schema and others. The suite runs against Zod 4 and Valibot, and CI runs it against Zod 3 as well.
- `createSchema(validate)` wraps a plain validation function, for custom rules, JSON Schema validators such as Ajv, or server-side errors.
- Exported types: `StandardSchema`, `FormSchema`, `SchemaIssue`, `ValidationIssue`, `InferSchemaOutput`, `BaseFormState`, `FormActions`, `FormComputed`, `FormInput`, `EnhancedForm`, `WithFormState`, `Leaf`, `ResetOptions`, `SubmitHandler`, `UseFormControllerOptions` and `UseStoreHook`.

### Changed

- Updates are immutable and structurally shared; `immer` and `lodash-es` are no longer bundled. The package is about 6 kB gzipped.
- Each controller holds a single store subscription and re-renders only when its own slice changes. A header reading `isValid` and `isDirty` re-renders only when a flag flips.
- `isValid` and `errors` stay consistent after `resetErrors` and `validate`.
- State written past the store api by another middleware, such as `persist` hydration or `devtools` time travel, is now picked up: errors and flags are recomputed from it and the values are adopted without being marked touched or dirty. Previously such writes left stale errors behind.
- The README documents every store shape, the hook, flags, actions and error access, and the repository ships a render-count test and benchmarks against react-hook-form.

### Deprecated

- `getDefaultForm(values)`. Pass the values to `withForm`, or return `{ values }` from the creator.
