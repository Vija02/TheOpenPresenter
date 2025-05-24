import { Progress } from "./components/ui/progress";

export interface PasswordStrengthProps {
  passwordStrength: number;
  suggestions: string[];
  isDirty: boolean;
}

function strengthToPercent(strength: number): number {
  // passwordStrength is a value 0-4
  return (strength + 1) * 2 * 10;
}

export function PasswordStrength({
  passwordStrength,
  suggestions = [
    "Use a few words, avoid common phrases",
    "No need for symbols, digits, or uppercase letters",
  ],
  isDirty = false,
}: PasswordStrengthProps) {
  if (!isDirty) {
    return null;
  }

  const content = (
    <ul className="list-disc list-inside">
      {suggestions.map((suggestion, key) => {
        return (
          <li key={key} className="text-secondary">
            {suggestion}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="stack-col items-start w-full">
      {passwordStrength < 2 && (
        <p className="text-secondary">
          You can proceed. However, we recommend choosing a stronger password.
        </p>
      )}
      <Progress
        className="w-full"
        value={strengthToPercent(passwordStrength)}
        variant={passwordStrength < 2 ? "destructive" : "success"}
      />
      {passwordStrength < 2 && content}
    </div>
  );
}
