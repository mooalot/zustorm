import { useMemo } from 'react';
import { z } from 'zod';
import { create } from 'zustand';
import {
  getDefaultForm,
  FormState,
  createFormController,
  withForm,
  createFormStore,
  HelloWorld,
  FormStoreProvider,
} from 'zustorm';

function App() {
  const store = useMemo(
    () =>
      createFormStore(
        { name: 'hi' },
        {
          getSchema: () =>
            z.object({
              name: z.string(),
            }),
        }
      ),
    []
  );

  console.log('store', store);

  // return null;
  return (
    <FormStoreProvider store={store}>
      <>hi</>
    </FormStoreProvider>
  );
}

export default App;
