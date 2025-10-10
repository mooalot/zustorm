import UserForm from './Example1';
import FriendsForm from './Example2';
import UserContextForm from './Example3';
import { Example4 } from './Example4';

function App() {
  return (
    <>
      <div>
        <h1>Zustorm Form Example</h1>
        <UserForm />
      </div>
      <div>
        <h1>Friends Form Example</h1>
        <FriendsForm />
      </div>
      <div>
        <h1>Example 3</h1>
        <UserContextForm />
      </div>
      <div>
        <h1>Example 4</h1>
        <Example4 />
      </div>
    </>
  );
}

export default App;
