import { VscArrowUp, VscBook } from "react-icons/vsc";

const Landing = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-10 text-center w-full h-full text-secondary">
      <VscBook size={48} />
      <p className="text-lg font-bold">No passages yet</p>
      <p className="max-w-md">
        Use the search bar above to look up a passage such as{" "}
        <span className="font-mono">John 3:16-18</span> or{" "}
        <span className="font-mono">Psalm 23</span> and add it to the scene.
      </p>
      <p className="flex items-center gap-1 text-sm">
        <VscArrowUp /> Start typing a book name for suggestions
      </p>
    </div>
  );
};

export default Landing;
