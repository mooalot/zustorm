export {
  withForm,
  type WithFormOptions,
  type WithFormAtOptions,
  getDefaultForm,
  resetForm,
  resetTouched,
  resetDirty,
  resetErrors,
  touchAll,
  validateForm,
  handleSubmit,
} from './form';
export { getFormApi, getScopedFormApi } from './scoped';
export { formatIssues, getErrorMessage, getErrorMessages } from './errors';
export {
  createSchema,
  type FormSchema,
  type InferSchemaOutput,
  type SchemaIssue,
  type SchemaPathSegment,
  type SchemaResult,
  type StandardSchema,
  type ValidationIssue,
} from './schema';
export { FormController } from './components';
export { useFormController } from './useFormController';
export { createFormStoreProvider } from './provider';
export type {
  FormState,
  BaseFormState,
  FormActions,
  FormComputed,
  ResetOptions,
  SubmitHandler,
  SubmitEventLike,
  FormControllerRenderProps,
  FormControllerProps,
  UseFormControllerOptions,
  UseStoreHook,
  FormInput,
  FormInputOf,
  RelaxedForm,
  EnhancedForm,
  WithFormState,
  Leaf,
  DeepKeys,
  DeepValue,
  Errors,
  Touched,
  Dirty,
  Nested,
} from './types';

import { createFormStoreProvider } from './provider';

const [FormStoreProvider, useFormStore] = createFormStoreProvider();

export { FormStoreProvider, useFormStore };
