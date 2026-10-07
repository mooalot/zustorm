export {
  withForm,
  type WithFormOptions,
  type WithFormAtOptions,
  getDefaultForm,
  createFormStore,
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
