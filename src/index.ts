import { createFormStoreProvider } from './utils';

export {
  createFormStore,
  getDefaultForm,
  withForm,
  getFormApi,
  createFormStoreProvider,
} from './utils';
export { FormController } from './components';
export type {
  FormState,
  FormControllerRenderProps,
  FormControllerProps,
  DeepKeys,
  DeepValue,
} from './types';
const [FormStoreProvider, useFormStore] = createFormStoreProvider();

export { FormStoreProvider, useFormStore };
