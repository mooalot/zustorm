import UserForm from './Example1';
import FriendsForm from './Example2';
import UserContextForm from './Example3';

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
    </>
  );
}

export default App;
