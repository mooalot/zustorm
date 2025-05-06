import { useMemo } from 'react';
import { z } from 'zod';
import { useStore } from 'zustand';
import {
  FormStoreProvider,
  createFormController,
  createFormStore,
  useFormStoreContext,
} from 'zustand-forms';

type Form = {
  name: string;
  address: {
    street: string;
    street2?: string;
    city: string;
    zip: string;
  };
  hobbies: {
    name: string;
  }[];
};

function App() {
  const store = useMemo(
    () =>
      createFormStore(
        {
          name: 'John Doe',
          address: {
            street: '123 Main St',
            city: 'Anytown',
            zip: '12345',
          },
          hobbies: [{ name: 'Jane' }],
        },
        {
          getSchema: () =>
            z.object({
              name: z.string().nonempty(),
              address: z.object({
                street: z.string().nonempty(),
                street2: z.string().optional(),
                city: z.string().nonempty(),
                zip: z.string().nonempty(),
              }),
              hobbies: z.array(
                z.object({
                  name: z.string().nonempty(),
                })
              ),
            }),
        }
      ),
    []
  );
  return (
    <FormStoreProvider store={store}>
      <FormComponent />
    </FormStoreProvider>
  );
}

function FormComponent() {
  const context = useFormStoreContext<Form>();
  const isValid = useStore(context, (state) => state.isValid);
  const isTouched = useStore(context, (state) => state.isTouched);
  const isDirty = useStore(context, (state) => state.isDirty);
  const FormController = useMemo(
    () => createFormController(context),
    [context]
  );
  return (
    <div style={{ padding: '20px', display: 'flex', gap: '20px' }}>
      <label>Form</label>
      <ul>
        <FormController
          name="name"
          render={({ value, onChange, error, onBlur }) => (
            <li>
              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                style={{
                  outline: error?._errors ? '1px solid red' : undefined,
                }}
              />
            </li>
          )}
        />

        <FormController
          name="address.street"
          render={({ value, onChange, error, onBlur }) => (
            <li>
              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                style={{
                  outline: error?._errors ? '1px solid red' : undefined,
                }}
              />
            </li>
          )}
        />
        <FormController
          name="address.street2"
          render={({ value, onChange, onBlur }) => (
            <li>
              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
              />
            </li>
          )}
        />

        <FormController
          name="address.city"
          render={({ value, onChange, error, onBlur }) => (
            <li>
              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                style={{
                  outline: error?._errors ? '1px solid red' : undefined,
                }}
              />
            </li>
          )}
        />

        <FormController
          name="address.zip"
          render={({ value, onChange, error, onBlur }) => (
            <li>
              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                style={{
                  outline: error?._errors ? '1px solid red' : undefined,
                }}
              />
            </li>
          )}
        />

        <label>Hobbies</label>
        <FormController
          name="hobbies"
          render={({ value, onChange }) => (
            <ul>
              {value.map((_, index) => (
                <li key={index}>
                  <FormController
                    name={`hobbies.${index}.name`}
                    render={({ value, onChange, error, onBlur }) => (
                      <input
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onBlur={onBlur}
                        style={{
                          outline: error?._errors ? '1px solid red' : undefined,
                        }}
                      />
                    )}
                  />

                  <button
                    onClick={() => {
                      const newHobbies = [...value];
                      newHobbies.splice(index, 1);
                      onChange(newHobbies);
                    }}
                  >
                    Remove Hobby
                  </button>
                </li>
              ))}
              <button
                onClick={() => {
                  const newHobby = { name: '' };
                  onChange([...value, newHobby]);
                }}
              >
                Add Hobby
              </button>
            </ul>
          )}
        />
      </ul>

      <FormController
        render={(field) => (
          <pre
            style={{
              background: isValid ? 'lightgreen' : 'lightcoral',
              padding: '10px',
              borderRadius: '5px',
            }}
          >
            {JSON.stringify(field.value, null, 2)}
          </pre>
        )}
      />
      <div>
        <div
          style={{
            border: '1px solid black',
            padding: '10px',
            borderRadius: '5px',
          }}
        >
          {isTouched ? 'Touched' : 'Not Touched'}
        </div>
        <div
          style={{
            border: '1px solid black',
            padding: '10px',
            borderRadius: '5px',
          }}
        >
          {isDirty ? 'Dirty' : 'Not Dirty'}
        </div>
      </div>
    </div>
  );
}

export default App;
