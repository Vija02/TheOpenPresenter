import { LoadingInline, cn } from "@repo/ui";

export const PickerCard = ({
  icon,
  text,
  onClick,
  isLoading,
}: {
  icon: React.ReactNode;
  text: string;
  onClick: () => void;
  isLoading?: boolean;
}) => {
  return (
    <div
      className={cn(
        "stack-col border border-stroke rounded-sm p-2 justify-center aspect-square w-36",
        isLoading && "cursor-not-allowed opacity-80",
        !isLoading && "cursor-pointer hover:border-blue-400",
      )}
      onClick={!isLoading ? onClick : undefined}
    >
      {icon}
      <p className="font-bold">{text}</p>
      {isLoading && <LoadingInline />}
    </div>
  );
};
