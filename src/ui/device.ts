import { useEffect, useState } from 'react';

/** Phones (narrow, or short in landscape with a finger). Tablets and desktops keep the full layout. */
export const COMPACT_QUERY = '(max-width: 699px), (max-height: 499px) and (pointer: coarse)';
export const TOUCH_QUERY = '(pointer: coarse)';

const mq = (q: string) => (typeof matchMedia !== 'undefined' ? matchMedia(q) : null);
export const isTouch = () => !!mq(TOUCH_QUERY)?.matches;
export const isCompact = () => !!mq(COMPACT_QUERY)?.matches;

function useQuery(q: string): boolean {
  const [on, setOn] = useState(() => !!mq(q)?.matches);
  useEffect(() => {
    const m = mq(q);
    if (!m) return;
    const f = () => setOn(m.matches);
    m.addEventListener('change', f);
    f();
    return () => m.removeEventListener('change', f);
  }, [q]);
  return on;
}
export const useCompact = () => useQuery(COMPACT_QUERY);
export const useTouch = () => useQuery(TOUCH_QUERY);
