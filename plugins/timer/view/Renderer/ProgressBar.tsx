type ProgressBarProps = {
  progress: number; // 0-100
  color: string;
  height?: number;
};

export const ProgressBar = ({
  progress,
  color,
  height = 8,
}: ProgressBarProps) => {
  return (
    <div className="w-full bg-gray-900" style={{ height }}>
      <div
        className="h-full transition-all duration-100 ease-linear"
        style={{
          width: `${Math.min(100, Math.max(0, progress))}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
};
