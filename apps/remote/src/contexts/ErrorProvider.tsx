import React, { createContext, useCallback, useContext, useState } from "react";

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

  const addError = useCallback(
    (code: string) => {
      if (!errors.includes(code)) {
        setErrors((x) => x.concat(code));
      }
    },
    [errors],
  );
  const removeError = useCallback(
    (code: string) => {
      if (errors.includes(code)) {
        setErrors((x) => x.filter((y) => y !== code));
      }
    },
    [errors],
  );

  return (
    <ErrorContext.Provider
      value={{
        errors,
        setErrors,
        addError,
        removeError,
      }}
    >
      {children}
    </ErrorContext.Provider>
  );
}

export function useError() {
  return useContext(ErrorContext);
}
