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
  // The block stays mounted and toggles visibility instead of unmounting text
  // nodes on every keystroke. A full unmount breaks when a browser translation
  // (for example Chrome on Android) wraps these text nodes, because React then
  // tries to remove DOM it no longer owns.
  const isWeak = passwordStrength < 2;

  // Inline `display` toggles the elements without dropping them from the tree.
  // A `hidden` attribute or utility class is not safe here, because the
  // `display` utility classes on these elements win over it.
  return (
    <div
      className="stack-col items-start w-full"
      style={{ display: isDirty ? undefined : "none" }}
    >
      <p
        className="text-secondary"
        style={{ display: isWeak ? undefined : "none" }}
      >
        You can proceed. However, we recommend choosing a stronger password.
      </p>
      <Progress
        className="w-full"
        value={strengthToPercent(passwordStrength)}
        variant={isWeak ? "destructive" : "success"}
      />
      <ul
        className="list-disc list-inside"
        style={{ display: isWeak ? undefined : "none" }}
      >
        {suggestions.map((suggestion, key) => {
          return (
            <li key={key} className="text-secondary">
              {suggestion}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
