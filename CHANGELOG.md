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
- Setting values on the store directly (for example `store.setState({ values })`) now marks the changed fields as dirty and touched, like a controller edit does. Use `reset(values)` to load values without flagging them.
- Field paths into optional objects now resolve to `T | undefined` rather than being rejected, and values such as `Date`, `File`, `Map`, `Set` and functions are treated as leaves. A path like `when.getTime` that previously type-checked no longer does.

### Added

- Form actions on the store and on every controller: `reset(values?, options?)`, `resetTouched()`, `resetDirty()`, `resetErrors()`, `touchAll()`, `validate()` and `handleSubmit(onValid, onInvalid?)`. `reset(values)` makes the supplied values the new baseline; pass `{ keepInitialValues: true }` to keep the old one. A controller scoped to a field resets or touches only that field.
- Derived flags `isValid`, `isDirty` and `isTouched` on the form and on every controller.
- Flat error access on controllers: `errorMessage` and `errorMessages`, plus the `getErrorMessage`, `getErrorMessages` and `formatIssues` helpers for use in selectors.
- `useFormController(store, name?, options?)`, the hook form of `FormController`.
- `getScopedFormApi(store, name)`, a form store scoped to a field with its own slices, flags and actions.
- `withForm` accepts the initial values directly, a creator returning `{ values, ...extra }` with the store type inferred, or a curried `create<State>()` creator using `set` and `get`, at the root or at `formPath`.
- Standalone helpers that take a store reference: `resetForm`, `resetTouched`, `resetDirty`, `resetErrors`, `touchAll`, `validateForm` and `handleSubmit`.
- Zod 4 support. The suite runs against Zod 4, and CI runs it against Zod 3 as well.
- Exported types: `BaseFormState`, `FormActions`, `FormComputed`, `FormInput`, `EnhancedForm`, `WithFormState`, `Leaf`, `ResetOptions`, `SubmitHandler`, `UseFormControllerOptions` and `UseStoreHook`.

### Changed

- Updates are immutable and structurally shared; `immer` and `lodash-es` are no longer bundled. The package is about 5.5 kB gzipped.
- Each controller holds a single store subscription and re-renders only when its own slice changes. A header reading `isValid` and `isDirty` re-renders only when a flag flips.
- `isValid` and `errors` stay consistent after `resetErrors` and `validate`.
- The README documents every store shape, the hook, flags, actions and error access, and the repository ships a render-count test and benchmarks against react-hook-form.

### Deprecated

- `getDefaultForm(values)`. Pass the values to `withForm`, or return `{ values }` from the creator.
