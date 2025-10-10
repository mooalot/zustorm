import { create } from 'zustand';
import {
  FormController,
  FormStoreProvider,
  getDefaultForm,
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

import z from 'zod';

type State = {
  form: FormState<Form>;
};

const useAppStore = create<State>()(
  withForm(
    () => ({
      form: getDefaultForm<Form>({
        friends: [],
        address: { street: '', city: '', zip: '' },
        name: 'bob',
        email: 'bob@example.com',
      }),
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

export function Example4() {
  return (
    <FormStoreProvider store={getFormApi(useAppStore, 'form')}>
        <button onClick={() => {
          const formApi = getFormApi(useAppStore, 'form');
          formApi.setState((state) => ({...state, values: {
            friends: [],
            address: { street: '', city: '', zip: '' },
            name: 'billy',
            email: 'billy@example.com',
            }}))
            console.log(useAppStore.getState().form.values);
        }}>Set Name to Billy</button>
      <h1>Example 4: Complex Form with Nested Fields and Arrays</h1>
      <FormComponent />
    </FormStoreProvider>
  );
}

function FormComponent() {
  const useForm = useFormStore<Form>();
  return (
    <>
      <FormController
        store={useForm}
        name="name"
        render={(props) => (
          <div>
            <label>
              Name:
              <input
                value={props.value}
                onChange={(e) => {
                  props.onChange(e.target.value);
                }}
              />
            </label>
            {props.error && (
              <span style={{ color: 'red' }}>{props.error._errors?.[0]}</span>
            )}
          </div>
        )}
      />
      <FormController
        store={useForm}
        name="email"
        render={(props) => (
          <div>
            <label>
              Email:
              <input
                value={props.value}
                onChange={(e) => props.onChange(e.target.value)}
              />
            </label>
          </div>
        )}
      />
      <h2>Address</h2>
      <FormController
        store={useForm}
        name="address.street"
        render={(props) => (
          <div>
            <label>
              Street:
              <input
                value={props.value}
                onChange={(e) => props.onChange(e.target.value)}
              />
            </label>
          </div>
        )}
      />
      <FormController
        store={useForm}
        name="address.city"
        render={(props) => (
          <div>
            <label>
              City:
              <input
                value={props.value}
                onChange={(e) => props.onChange(e.target.value)}
              />
            </label>
          </div>
        )}
      />
      <FormController
        store={useForm}
        name="address.zip"
        render={(props) => (
          <div>
            <label>
              ZIP:
              <input
                value={props.value}
                onChange={(e) => props.onChange(e.target.value)}
              />
            </label>
          </div>
        )}
      />
      <h2>Friends</h2>
      <FormController
        store={useForm}
        name="friends"
        render={(props) => (
          <div>
            {props.value.map((_, index) => (
              <div
                key={index}
                style={{ border: '1px solid black', marginBottom: 10 }}
              >
                <FormController
                  store={useForm}
                  name={`friends.${index}.name`}
                  render={(friendNameProps) => (
                    <div>
                      <label>
                        Name:
                        <input
                          value={friendNameProps.value}
                          onChange={(e) =>
                            friendNameProps.onChange(e.target.value)
                          }
                        />
                      </label>
                    </div>
                  )}
                />
                <FormController
                  store={useForm}
                  name={`friends.${index}.email`}
                  render={(friendEmailProps) => (
                    <div>
                      <label>
                        Email:
                        <input
                          value={friendEmailProps.value}
                          onChange={(e) =>
                            friendEmailProps.onChange(e.target.value)
                          }
                        />
                      </label>
                    </div>
                  )}
                />
                <button
                  onClick={() => {
                    const newFriends = props.value.filter(
                      (_, i) => i !== index
                    );
                    props.onChange(newFriends);
                  }}
                >
                  Remove Friend
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                props.onChange([...props.value, { name: '', email: '' }])
              }
            >
              Add Friend
            </button>
          </div>
        )}
      />
    </>
  );
}
