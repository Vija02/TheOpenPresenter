import { LayoutItem } from "@repo/base-plugin";
import { useData } from "@repo/shared";
import { Button } from "@repo/ui";
import { VscTrash } from "react-icons/vsc";

type LayoutItemsListProps = {
  items: LayoutItem[];
  rendererId: string;
  onRemove: (itemId: string) => void;
  onDerivationChange: (itemId: string, offset: number | null) => void;
};

const LayoutItemsList = ({
  items,
  rendererId,
  onRemove,
  onDerivationChange,
}: LayoutItemsListProps) => {
  const data = useData();

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 items-start w-full">
      <p className="font-medium text-sm">
        Active Elements
        <span className="ml-2 text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-normal">
          Beta
        </span>
      </p>
      <div className="flex flex-col gap-1 w-full">
        {items.map((item) => {
          const isScreenItem = item.type === "screenItem";
          const scene = !isScreenItem ? data.data[item.sceneId] : null;
          const sourceRendererId = item.sourceRendererId || rendererId;

          return (
            <div
              key={item.id}
              className="flex items-center justify-between py-1.5 px-3 bg-surface-secondary rounded text-sm"
            >
              <div className="flex items-center gap-2">
                {isScreenItem ? (
                  <>
                    <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                      Screen
                    </span>
                    <span>Screen {sourceRendererId}</span>
                  </>
                ) : (
                  <>
                    <span>{scene?.name || "Unknown"}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                      from Screen {item.sourceRendererId}
                    </span>
                  </>
                )}
                {item.derivation && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                    {item.derivation.offset > 0 ? "+" : ""}
                    {item.derivation.offset}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="text-xs border rounded px-2 py-1"
                  value={item.derivation?.offset ?? "none"}
                  onChange={(e) => {
                    const val = e.target.value;
                    onDerivationChange(
                      item.id,
                      val === "none" ? null : parseInt(val, 10),
                    );
                  }}
                >
                  <option value="none">Current</option>
                  <option value="-1">-1 (Previous)</option>
                  <option value="1">+1 (Next)</option>
                </select>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(item.id)}
                >
                  <VscTrash />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LayoutItemsList;
