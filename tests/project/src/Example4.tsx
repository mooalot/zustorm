import { z } from 'zod';
import { create } from 'zustand';
import {
  FormController,
  FormStoreProvider,
  getFormApi,
  useFormStore,
  withForm,
  type FormState,
} from 'zustorm';

type Person = {
  name: string;
  email: string;
};
export type Form = {
  friends: Person[];
  address: { street: string; city: string; zip: string };
} & Person;

// The form lives inside a bigger app store, next to unrelated state and
// actions. The store type comes from `create<State>()`, and `formPath` tells
// withForm where the form is. `set` and `get` are fully typed.
type State = {
  form: FormState<Form>;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
};

const useAppStore = create<State>()(
  withForm(
    (set) => ({
      form: {
        values: {
          friends: [],
          address: { street: '', city: '', zip: '' },
          name: 'bob',
          email: 'bob@example.com',
        },
      },
      theme: 'light',
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
    }),
    {
      formPath: 'form',
      getSchema: () =>
        z.object({
          friends: z.array(
            z.object({
              name: z.string().min(1, 'Name is required'),
              email: z.string().email('Invalid email address'),
            })
          ),
          address: z.object({
            street: z.string().min(1, 'Street is required'),
            city: z.string().min(1, 'City is required'),
            zip: z.string().min(1, 'ZIP is required'),
          }),
          name: z.string().min(1, 'Name is required'),
          email: z.string().email('Invalid email address'),
        }),
    }
  )
);

// A store api for just the form, usable anywhere a form store is expected.
const formStore = getFormApi(useAppStore, 'form');

export function Example4() {
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);

  return (
    <FormStoreProvider store={formStore}>
      <div
        style={{
          background: theme === 'dark' ? '#222' : 'white',
          color: theme === 'dark' ? 'white' : 'black',
          padding: 16,
        }}
      >
        <button type="button" onClick={toggleTheme}>
          Theme: {theme}
        </button>
        <button
          type="button"
          onClick={() => {
            // reset(values) loads new values and makes them the baseline.
            formStore.getState().reset({
              friends: [],
              address: { street: '', city: '', zip: '' },
              name: 'billy',
              email: 'billy@example.com',
            });
            console.log(useAppStore.getState().form.values);
          }}
        >
          Load Billy
        </button>
        <h1>Example 4: Form inside an app store</h1>
        <FormComponent />
      </div>
    </FormStoreProvider>
  );
}

function TextField({
  name,
  label,
}: {
  name: 'name' | 'email' | 'address.street' | 'address.city' | 'address.zip';
  label: string;
}) {
  const store = useFormStore<Form>();
  return (
    <FormController
      store={store}
      name={name}
      render={({ value, onChange, onBlur, errorMessage, isTouched }) => (
        <div>
          <label>
            {label}:
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
            />
          </label>
          {isTouched && errorMessage && (
            <span style={{ color: 'red' }}>{errorMessage}</span>
          )}
        </div>
      )}
    />
  );
}

function FormComponent() {
  const store = useFormStore<Form>();
  return (
    <>
      <TextField name="name" label="Name" />
      <TextField name="email" label="Email" />
      <h2>Address</h2>
      <TextField name="address.street" label="Street" />
      <TextField name="address.city" label="City" />
      <TextField name="address.zip" label="ZIP" />
      <h2>Friends</h2>
      <FormController
        store={store}
        name="friends"
        render={({ value: friends, onChange }) => (
          <div>
            {friends.map((_, index) => (
              <div
                key={index}
                style={{ border: '1px solid gray', marginBottom: 10 }}
              >
                <FormController
                  store={store}
                  name={`friends.${index}.name`}
                  render={(field) => (
                    <div>
                      <label>
                        Name:
                        <input
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          onBlur={field.onBlur}
                        />
                      </label>
                      {field.isTouched && field.errorMessage}
                    </div>
                  )}
                />
                <FormController
                  store={store}
                  name={`friends.${index}.email`}
                  render={(field) => (
                    <div>
                      <label>
                        Email:
                        <input
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          onBlur={field.onBlur}
                        />
                      </label>
                      {field.isTouched && field.errorMessage}
                    </div>
                  )}
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange(friends.filter((_, i) => i !== index))
                  }
                >
                  Remove Friend
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange([...friends, { name: '', email: '' }])}
            >
              Add Friend
            </button>
          </div>
        )}
      />
    </>
  );
}
