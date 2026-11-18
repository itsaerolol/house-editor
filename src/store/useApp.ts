import { useShallow } from 'zustand/react/shallow';
import { useStore } from './store';

type S = ReturnType<typeof useStore.getState>;
// fields that change on every pointer move or walk step; whole-store readers must not re-render for them
const VOLATILE = new Set<string>(['hover', 'walkInfo']);

/** The store minus high-frequency fields, compared shallowly: a drop-in for useStore() in UI panels. */
export function useApp(): S {
  return useStore(
    useShallow((s) => {
      const o: Record<string, unknown> = {};
      for (const k in s) if (!VOLATILE.has(k)) o[k] = (s as unknown as Record<string, unknown>)[k];
      return o as unknown as S;
    }),
  );
}
