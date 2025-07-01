import { useMemo } from 'react';
import { z } from 'zod';
import {
  createFormStore,
  FormController,
  FormStoreProvider,
  useFormStore,
} from 'zustorm';

function App() {
  const store = useMemo(
    () =>
      createFormStore(
        { name: 'hi' },
        {
          getSchema: () =>
            z.object({
              name: z.string().regex(/^[a-zA-Z]+$/, {
                message: 'Name must contain only letters',
              }),
            }),
        }
      ),
    []
  );

  return (
    <FormStoreProvider store={store}>
      <Component />
    </FormStoreProvider>
  );
}

function Component() {
  const formStore = useFormStore<{ name: string }>();

  return (
    <FormController
      store={formStore}
      name="name"
      render={(props) => (
        <div>
          <input
            type="text"
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            onBlur={() => {
              console.log('Input blurred');
              props.onBlur?.();
            }}
          />
          <div>
            <div>{props.error?._errors?.[0] || 'No errors'}</div>
            <div>{props.touched?._touched ? 'Touched' : 'Not touched'}</div>
            <div>{props.dirty?._dirty ? 'Dirty' : 'Not dirty'}</div>
          </div>
        </div>
      )}
    />
  );
}

export default App;
