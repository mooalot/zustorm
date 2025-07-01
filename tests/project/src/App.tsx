import { useMemo } from 'react';
import { z } from 'zod';
import { createFormStore, FormStoreProvider } from 'zustorm';

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

  return <FormStoreProvider store={store}></FormStoreProvider>;
}

function Component() {
  // const formStore = useFormS
}

export default App;
