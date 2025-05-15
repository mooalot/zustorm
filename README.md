# Zustorm

A way to use Zustand and Zod for form management.

## Features

- **Simple API**: Takes the complexity out of form management, just like Zustand does for state management.
- **No Need For Documentation**: No need to read through complex documentation, because it just works.
- **Type Safety**: Built with TypeScript, ensuring type safety and autocompletion.
- **Validation**: Integrates with Zod for schema validation, making it easy to validate form data.

## Installation

To use Zustorm, you need to install the package along with Zustand and Zod. (I may add support for other validation libraries in the future.)

```bash
npm install zustorm zod zustand
```

## Usage Example

```typescript
import { z } from 'zod';
import { create } from 'zustand';
import {
  getDefaultForm,
  FormState,
  createFormController,
  withForm,
} from 'zustorm';

type Form = {
  name: string;
};

const useStore = create<FormState<Form>>()(
  withForm(
    () =>
      getDefaultForm({
        name: 'John Doe',
      }),
    {
      getSchema: () =>
        z.object({
          name: z.string().nonempty(),
        }),
    }
  )
);

const FormController = createFormController(useStore);

function Form() {
  const isValid = useStore((state) => state.isValid);
  const isTouched = useStore((state) => state.isTouched);
  const isDirty = useStore((state) => state.isDirty);

  return (
    <FormController
      name="name"
      render={({ value, onChange, error, onBlur }) => (
        <li>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            style={{
              outline: error ? '1px solid red' : undefined,
            }}
          />
        </li>
      )}
    />
  );
}
```

## Store or Controller?

You can use either the store or the controller to manage your form state. The store is a Zustand store that holds the form state, while the controller is a component that provides a convenient way to interact with the form state. Either way, the form will be
maintain its state and validation.

## API

The following exports are available for managing form states and logic:

| Export                 | Description                                                           |
| ---------------------- | --------------------------------------------------------------------- |
| `createFormStore`      | Creates a store to manage form state.                                 |
| `createFormController` | Initializes a controller to handle form actions and interactions.     |
| `useFormStoreContext`  | A hook to access the form store context within a component.           |
| `getDefaultForm`       | Retrieves the default state of the form.                              |
| `createFormComputer`   | Generates computed properties based on form state.                    |
| `withForm`             | A higher-order function to enhance components with form capabilities. |

### Components

| Component           | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `FormStoreProvider` | Provides the form store context to child components. |

## More Examples

- [Global Example](https://github.com/mooalot/zustorm/tree/main/examples/global)
- [Context Example](https://github.com/mooalot/zustorm/tree/main/examples/context)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request if you have suggestions or improvements.
