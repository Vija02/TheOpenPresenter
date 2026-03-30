import { OwnedScene } from "@repo/base-plugin";
import { ObjectToTypedMap } from "@repo/lib";

export const getSceneOwnershipStatus = (
  ownedScenes:
    | ObjectToTypedMap<Record<string, OwnedScene>>
    | Record<string, OwnedScene>
    | null
    | undefined,
  sceneId: string,
): { owned: boolean; visible: boolean } => {
  // If ownedScenes is null, renderer owns all and all are visible
  if (ownedScenes === null || ownedScenes === undefined) {
    return { owned: true, visible: true };
  }

  const owned =
    "get" in ownedScenes
      ? ownedScenes?.get(sceneId)
      : (ownedScenes?.[sceneId] ?? null);

  if (!owned) {
    return { owned: false, visible: false };
  }

  return {
    owned: true,
    visible: "get" in owned ? owned.get("visible") : owned.visible,
  };
};
