import { Text, VStack } from "@chakra-ui/react";

import { ProgressBar, ProgressRoot } from "./Chakra/progress";

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
    <ul>
      {suggestions.map((suggestion, key) => {
        return (
          <li key={key}>
            <Text color="subtitle">{suggestion}</Text>
          </li>
        );
      })}
    </ul>
  );

  return (
    <VStack alignItems="flex-start" w="100%">
      {passwordStrength < 2 && (
        <Text color="subtitle">
          You can proceed. However, we recommend choosing a stronger password.
        </Text>
      )}
      <ProgressRoot
        w="100%"
        value={strengthToPercent(passwordStrength)}
        colorPalette={passwordStrength < 2 ? "red" : "green"}
      >
        <ProgressBar />
      </ProgressRoot>
      {passwordStrength < 2 && content}
    </VStack>
  );
}
