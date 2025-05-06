import { create } from 'zustand';
import { multiPersist } from 'zustand-multi-persist';
import { createJSONStorage } from 'zustand/middleware';

type State = {
  localCount: number;
  sessionCount: number;
};

const useStore = create<State>()(
  multiPersist(
    () => ({
      localCount: 0,
      sessionCount: 0,
    }),
    {
      // The key is the name of the storage
      local: {
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ localCount: state.localCount }),
      },
      session: {
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({ sessionCount: state.sessionCount }),
      },
    }
  )
);

function App() {
  const localCount = useStore((state) => state.localCount);
  const sessionCount = useStore((state) => state.sessionCount);

  return (
    <div>
      <h1>Local Count: {localCount}</h1>
      <h1>Session Count: {sessionCount}</h1>
      <button onClick={() => useStore.setState({ localCount: localCount + 1 })}>
        Increment Local Count
      </button>
      <button
        onClick={() => useStore.setState({ sessionCount: sessionCount + 1 })}
      >
        Increment Session Count
      </button>

      <button onClick={() => useStore.persistMap.local.clearStorage()}>
        Clear Local Storage
      </button>
      <button onClick={() => useStore.persistMap.session.clearStorage()}>
        Clear Session Storage
      </button>
    </div>
  );
}

export default App;
