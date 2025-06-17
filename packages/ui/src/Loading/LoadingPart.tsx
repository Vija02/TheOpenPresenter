import "./LoadingPart.css";

export function LoadingPart() {
  return (
    <div className="flex justify-center items-center h-full w-full">
      <div className="relative inline-flex">
        <div className="ui--loading-part__circle" />
        <div className="ui--loading-part__circle absolute top-0 left-0 animate-ping" />
        <div className="ui--loading-part__circle absolute top-0 left-0 animate-pulse" />
      </div>
    </div>
  );
}
