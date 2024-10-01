// Taken from: https://github.com/microsoft/use-disposable/issues/26
import {
  DependencyList,
  EffectCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { useIsStrictMode } from "./useIsStrictMode";

type IDisposable = () => void;

const queue: (fn: () => void) => void =
  typeof queueMicrotask === "function"
    ? queueMicrotask
    : (cb: () => void) => void Promise.resolve().then(cb);

const useStrictEffect = (effect: EffectCallback) => {
  const canDisposeRef = useRef(false);

  useEffect(() => {
    const dispose = effect();
    canDisposeRef.current = false;

    if (dispose) {
      return () => {
        canDisposeRef.current = true;
        queue(() => {
          if (!canDisposeRef.current) return;
          dispose();
        });
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

// eslint-disable-next-line react-hooks/exhaustive-deps
const useFreeEffect = (effect: EffectCallback) => useEffect(effect, []);

/**
 * Get or create an instance which is automatically disposed by this hook.
 *
 * @param create an instance factory which return instance and dispose pairs
 * @param deps when to create a new instance
 * @returns a managed instance
 */
export default function useDisposable<T>(
  create: () => readonly [T, IDisposable],
  deps: DependencyList = [],
): T {
  // @ts-ignore
  const ref = useRef<IDisposable>();

  const isStrictMode = useIsStrictMode();
  const instance = useMemo(() => {
    if (ref.current) {
      // firstly dispose the last instance before create
      ref.current();
    }
    const [d, dispose] = create();
    if (typeof window === "undefined") {
      // dispose should be invoked upon the server side
      queue(() => dispose());
    } else {
      ref.current = dispose;
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const useEffect = isStrictMode ? useStrictEffect : useFreeEffect;
  useEffect(() => {
    const dispose = ref.current;
    if (!dispose) return;

    return () => {
      dispose();
      // @ts-ignore
      ref.current = undefined;
    };
  });

  return instance;
}

export { useDisposable };
