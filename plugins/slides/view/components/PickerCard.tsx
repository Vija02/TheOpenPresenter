import { LoadingInline, cn } from "@repo/ui";

export const PickerCard = ({
  icon,
  text,
  onClick,
  isLoading,
  isDisabled,
  testId,
}: {
  icon: React.ReactNode;
  text: string;
  onClick: () => void;
  isLoading?: boolean;
  isDisabled?: boolean;
  testId?: string;
}) => {
  const isInert = isLoading || isDisabled;

  return (
    <div
      className={cn(
        "stack-col border border-stroke rounded-sm p-2 justify-center aspect-square w-36",
        isInert && "cursor-not-allowed opacity-80",
        isDisabled && "opacity-50",
        !isInert && "cursor-pointer hover:border-blue-400",
      )}
      onClick={!isInert ? onClick : undefined}
      data-testid={testId}
      aria-disabled={isDisabled || undefined}
    >
      {icon}
      <p className="font-bold">{text}</p>
      {isLoading && <LoadingInline />}
    </div>
  );
};
