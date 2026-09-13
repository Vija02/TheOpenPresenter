import { projectName } from "@repo/config";
import { Logo } from "@repo/ui";
import * as React from "react";
import { useEffect } from "react";

export type OnboardingShellProps = {
  title: string;
  /** 1-based index of the step the user is on. */
  step: number;
  totalSteps: number;
  heading: React.ReactNode;
  subheading?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/** A full-page frame for onboarding */
export const OnboardingShell = ({
  title,
  step,
  totalSteps,
  heading,
  subheading,
  children,
  footer,
}: OnboardingShellProps) => {
  useEffect(() => {
    document.title = `${title} | ${projectName}`;
  }, [title]);

  return (
    <div className="min-h-dvh flex flex-col bg-white">
      <div className="w-full bg-black">
        <div className="max-w-xl mx-auto px-5 py-4 flex justify-center">
          <Logo height="32px" />
        </div>
      </div>

      <div className="w-full max-w-xl mx-auto px-5 pt-6">
        <OnboardingProgress step={step} totalSteps={totalSteps} />
      </div>

      <div className="flex-1 md:flex-none w-full max-w-xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-bold">{heading}</h1>
        {subheading != null && (
          <p className="text-secondary mt-2">{subheading}</p>
        )}

        <div className="mt-6">{children}</div>
      </div>

      {footer != null && (
        // On mobile the footer is pinned to the bottom of the screen
        <div className="w-full border-t border-gray-200 md:border-t-0">
          <div className="max-w-xl mx-auto px-5 py-4 md:pt-0 md:pb-10">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
};

const OnboardingProgress = ({
  step,
  totalSteps,
}: {
  step: number;
  totalSteps: number;
}) => {
  return (
    <div
      className="flex gap-1.5"
      role="progressbar"
      aria-valuenow={step}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-label={`Step ${step} of ${totalSteps}`}
    >
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full ${
            i < step ? "bg-fill-success" : "bg-surface-tertiary"
          }`}
        />
      ))}
    </div>
  );
};
