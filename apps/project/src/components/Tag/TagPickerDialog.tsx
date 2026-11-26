import { TagFragment } from "@repo/graphql";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from "@repo/ui";
import { useMemo, useState } from "react";
import { FiCheck, FiPlus } from "react-icons/fi";

import { Tag } from "./Tag";
import { TagSettingsPrompt } from "./TagsSelector";
import "./TagsSelector.css";

type PropTypes = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: TagFragment[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Resolves to the new tag's id, which then gets selected */
  onCreate: (name: string) => Promise<string | undefined>;
};

/**
 * Picking tags on a phone: a centred card with a row per tag, tapped on or off.
 */
export function TagPickerDialog({
  open,
  onOpenChange,
  tags,
  selectedIds,
  onChange,
  onCreate,
}: PropTypes) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const query = search.trim().toLowerCase();
  const shown = useMemo(
    () =>
      query ? tags.filter((t) => t.name.toLowerCase().includes(query)) : tags,
    [tags, query],
  );
  const canCreate =
    query !== "" && !tags.some((t) => t.name.toLowerCase() === query);

  const toggle = (id: string) =>
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );

  const create = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      const id = await onCreate(search.trim());
      if (id) onChange([...selectedIds, id]);
      setSearch("");
    } finally {
      setCreating(false);
    }
  };

  const close = () => {
    onOpenChange(false);
    setSearch("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
    >
      <DialogContent hideCloseButton className="project--tag-picker">
        <DialogHeader className="project--tag-picker__header">
          <DialogTitle>Tags</DialogTitle>
          <Button type="button" variant="ghost" size="sm" onClick={close}>
            Done
          </Button>
        </DialogHeader>

        <div className="project--tag-picker__search">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              // Enter creates the tag rather than submitting the form behind
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
            placeholder="Search or create a tag"
            aria-label="Search or create a tag"
            enterKeyHint="done"
          />
        </div>

        <div className="project--tag-picker__list">
          {canCreate && (
            <button
              type="button"
              className="project--tag-picker__row"
              disabled={creating}
              onClick={create}
            >
              <span className="project--tag-picker__create">
                <FiPlus aria-hidden />
                Create “{search.trim()}”
              </span>
            </button>
          )}
          {shown.map((tag) => {
            const selected = selectedIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                role="checkbox"
                aria-checked={selected}
                aria-label={tag.name}
                className="project--tag-picker__row"
                onClick={() => toggle(tag.id)}
              >
                <Tag tag={tag} />
                {selected && (
                  <FiCheck className="project--tag-picker__check" aria-hidden />
                )}
              </button>
            );
          })}
          {tags.length === 0 && !canCreate && (
            <p className="project--tag-picker__empty">
              No tags yet. Type a name above to create one.
            </p>
          )}
        </div>

        {/* Same link as the bottom of the desktop dropdown */}
        <div className="project--tag-picker__footer">
          <TagSettingsPrompt size="lg" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
