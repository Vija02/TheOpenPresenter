import { PasswordStrength } from "@repo/ui";
import { useFormikContext } from "formik";
import React, { useMemo } from "react";
import zxcvbn from "zxcvbn";

type FormInputs = {
  password: string;
};

// Only to be used in the context of formik
export const WrappedPasswordStrength = () => {
  const formik = useFormikContext<FormInputs>();

  const [passwordStrength, passwordSuggestions] = useMemo(() => {
    const { score, feedback } = zxcvbn(formik.values.password || "");

    const messages = [...feedback.suggestions];
    if (feedback.warning !== "") {
      messages.push(feedback.warning);
    }

    return [score, messages];
  }, [formik.values.password]);

  const isDirty = formik.values.password !== "";

  return (
    <PasswordStrength
      passwordStrength={passwordStrength}
      suggestions={passwordSuggestions}
      isDirty={isDirty}
    />
  );
};
