/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";

type RuntimeStore = {
  getJoinedSnapshot: () => boolean;
  registerJoinedOwner: (owner: symbol) => () => void;
  subscribe: (listener: () => void) => () => void;
};

function createRuntimeStore(): RuntimeStore {
  const joinedOwners = new Set<symbol>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  return {
    getJoinedSnapshot: () => joinedOwners.size > 0,
    registerJoinedOwner: (owner) => {
      const wasJoined = joinedOwners.size > 0;
      joinedOwners.add(owner);
      if (!wasJoined) emit();

      return () => {
        const wasJoinedBeforeCleanup = joinedOwners.size > 0;
        joinedOwners.delete(owner);
        if (wasJoinedBeforeCleanup && joinedOwners.size === 0) emit();
      };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const WorkroomAnnouncementRuntimeContext = createContext<RuntimeStore | null>(
  null,
);

export function WorkroomAnnouncementRuntimeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { session } = useAuth();
  const ownerKey = session?.token ?? "anonymous";
  return (
    <WorkroomAnnouncementRuntimeOwner key={ownerKey}>
      {children}
    </WorkroomAnnouncementRuntimeOwner>
  );
}

function WorkroomAnnouncementRuntimeOwner({
  children,
}: {
  children: ReactNode;
}) {
  const [store] = useState(createRuntimeStore);

  return (
    <WorkroomAnnouncementRuntimeContext.Provider value={store}>
      {children}
    </WorkroomAnnouncementRuntimeContext.Provider>
  );
}

function useRuntimeStore(): RuntimeStore {
  const store = useContext(WorkroomAnnouncementRuntimeContext);
  if (!store) {
    throw new Error("Workroom announcement runtime provider is missing.");
  }
  return store;
}

export function useReportJoinedWorkroomSession(joined: boolean): void {
  const store = useRuntimeStore();
  const ownerRef = useRef(Symbol("joined-workroom-session"));

  useEffect(() => {
    if (!joined) return undefined;
    return store.registerJoinedOwner(ownerRef.current);
  }, [joined, store]);
}

export function useHasJoinedWorkroomSession(): boolean {
  const store = useRuntimeStore();
  return useSyncExternalStore(
    store.subscribe,
    store.getJoinedSnapshot,
    store.getJoinedSnapshot,
  );
}
