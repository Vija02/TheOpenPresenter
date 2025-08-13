import { PasswordStrength } from "@repo/ui";
import { useMemo } from "react";
import zxcvbn from "zxcvbn";

// Only to be used in the context of react-hook-form
// zxcvbn is huge. So this component should only be lazy loaded
export const PasswordStrength_DoNotImportDirectly = ({
  password,
}: {
  password: string;
}) => {
  const [passwordStrength, passwordSuggestions] = useMemo(() => {
    const { score, feedback } = zxcvbn(password || "");

    const messages = [...feedback.suggestions];
    if (feedback.warning !== "") {
      messages.push(feedback.warning);
    }

    return [score, messages];
  }, [password]);

  const isDirty = password !== "";

  return (
    <PasswordStrength
      passwordStrength={passwordStrength}
      suggestions={passwordSuggestions}
      isDirty={isDirty}
    />
  );
};

export default PasswordStrength_DoNotImportDirectly;
