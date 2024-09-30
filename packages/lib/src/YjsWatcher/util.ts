import { AbstractType } from "yjs";

export const getPathsFromSharedType = (data: AbstractType<any>): string[] => {
  if (!data._item || !data._item.parentSub) {
    return [];
  }

  if (!data.parent) {
    return [data._item.parentSub];
  }
  return [...getParents(data), data._item.parentSub];
};

const getParents = (data: AbstractType<any>): string[] => {
  if (data?.parent) {
    if (!data.parent._item || !data.parent._item.parentSub) {
      return [...getParents(data.parent)];
    }
    return [...getParents(data.parent), data.parent._item.parentSub];
  }
  return [];
};

export const isYjsObj = (data: any) =>
  !!data && typeof data === "object" && "doc" in data;
