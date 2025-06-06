export const DebugPadding = ({
  padding,
}: {
  padding: [number, number, number, number];
}) => {
  return (
    <>
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: `${padding[0]}px`,
          backgroundColor: "#5042B2",
        }}
      />
      <div
        className="absolute right-0 top-0 bottom-0"
        style={{
          width: `${padding[1]}px`,
          backgroundColor: "#5042B2",
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: `${padding[2]}px`,
          backgroundColor: "#5042B2",
        }}
      />
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{
          width: `${padding[3]}px`,
          backgroundColor: "#5042B2",
        }}
      />
    </>
  );
};
