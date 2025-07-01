import { z } from 'zod';
import { create } from 'zustand';
import { withForm, getDefaultForm, FormController } from '../dist';

type Form = {
  name: string;
  email: string;
};

// Create store with form enhancement
const useUserForm = create(
  withForm(
    () =>
      getDefaultForm<Form>({
        name: '',
        email: '',
      }),
    {
      getSchema: () =>
        z.object({
          name: z.string().min(1, 'Name is required'),
          email: z.string().email('Invalid email'),
        }),
    }
  )
);

// Use in component
function UserForm() {
  const isValid = useUserForm((state) => !state.errors);
  const isDirty = useUserForm((state) => state.dirty);

  return (
    <form>
      <FormController
        store={useUserForm}
        name="name"
        render={({ value, onChange, error }) => (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Name"
            style={{ borderColor: error ? 'red' : 'gray' }}
          />
        )}
      />
      <FormController
        store={useUserForm}
        name="email"
        render={({ value, onChange, error }) => (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Email"
            style={{ borderColor: error ? 'red' : 'gray' }}
          />
        )}
      />
      <button disabled={!isValid || !isDirty}>Submit</button>
    </form>
  );
}

// function App() {
//   const store = useMemo(
//     () =>
//       createFormStore<UserForm>(
//         { name: '', email: '' },
//         {
//           getSchema: () =>
//             z.object({
//               name: z.string().min(1, 'Name is required'),
//               email: z.string().email('Invalid email'),
//             }),
//         }
//       ),
//     []
//   );

//   return (
//     <FormStoreProvider store={store}>
//       <UserForm />
//     </FormStoreProvider>
//   );
// }

// function UserForm() {
//   const store = useFormStore<UserForm>();
//   const { isValid, isDirty } = store.getState();

//   return (
//     <form>
//       <FormController
//         name="name"
//         render={({ value, onChange, error }) => (
//           <input
//             value={value}
//             onChange={(e) => onChange(e.target.value)}
//             placeholder="Name"
//             style={{ borderColor: error ? 'red' : 'gray' }}
//           />
//         )}
//       />
//       <FormController
//         name="email"
//         render={({ value, onChange, error }) => (
//           <input
//             value={value}
//             onChange={(e) => onChange(e.target.value)}
//             placeholder="Email"
//             style={{ borderColor: error ? 'red' : 'gray' }}
//           />
//         )}
//       />
//       <button disabled={!isValid || !isDirty}>Submit</button>
//     </form>
//   );
// }

// type AppState = {
//   userForm: FormState<UserForm>;
//   submitForm: () => void;
// };

// const useAppStore = create<AppState>()(
//   withForm(
//     (set, get) => ({
//       userForm: getDefaultForm<UserForm>({
//         name: '',
//         email: '',
//       }),
//       submitForm: () => {
//         const { userForm } = get();
//         if (userForm.isValid) {
//           console.log('Submitting:', userForm.values);
//         }
//       },
//     }),
//     {
//       formPath: 'userForm',
//       getSchema: () =>
//         z.object({
//           name: z.string().min(1, 'Name is required'),
//           email: z.string().email('Invalid email'),
//         }),
//     }
//   )
// );
