import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ErrorProviderType = {
  errors: string[];
  setErrors: React.Dispatch<React.SetStateAction<string[]>>;
  addError: (code: string) => void;
  removeError: (code: string) => void;
};

const initialData: ErrorProviderType = {
  errors: [],
  setErrors: () => {},
  addError: () => {},
  removeError: () => {},
};

export const ErrorContext = createContext<ErrorProviderType>(initialData);

export function ErrorProvider({ children }: React.PropsWithChildren<{}>) {
  const [errors, setErrors] = useState<string[]>([]);

  const addError = useCallback((code: string) => {
    setErrors((x) => (x.includes(code) ? x : x.concat(code)));
  }, []);
  const removeError = useCallback((code: string) => {
    setErrors((x) => (x.includes(code) ? x.filter((y) => y !== code) : x));
  }, []);

  const value = useMemo(
    () => ({ errors, setErrors, addError, removeError }),
    [errors, addError, removeError],
  );

  return (
    <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>
  );
}

export function useError() {
  return useContext(ErrorContext);
}
