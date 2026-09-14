import { Setlist } from "./setlistTypes";

export const SetlistCard = ({
  setlist,
  onSelect,
}: {
  setlist: Setlist;
  onSelect: () => void;
}) => (
  <div
    data-testid="ly-setlist-card"
    className="w-56 shrink-0 p-2 cursor-pointer rounded border border-stroke hover:bg-surface-primary-hover"
    onClick={onSelect}
  >
    <p className="font-bold overflow-hidden text-ellipsis whitespace-nowrap">
      {setlist.title}
    </p>
    {setlist.subtitle && (
      <p className="text-xs text-secondary overflow-hidden text-ellipsis whitespace-nowrap">
        {setlist.subtitle}
      </p>
    )}
    <div className="text-secondary text-sm mt-1 max-h-24 overflow-y-auto">
      {setlist.content.map((song) => (
        <p
          key={song.key}
          className="text-ellipsis overflow-hidden whitespace-nowrap"
        >
          - {song.title}
        </p>
      ))}
      {setlist.content.length === 0 && <p>No songs in this setlist</p>}
    </div>
  </div>
);
