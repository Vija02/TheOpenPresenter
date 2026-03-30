import { OwnedScene } from "@repo/base-plugin";

export const getSceneOwnershipStatus = (
  ownedScenes: Record<string, OwnedScene> | null | undefined,
  sceneId: string,
): { owned: boolean; visible: boolean } => {
  // If ownedScenes is null, renderer owns all and all are visible
  if (ownedScenes === null || ownedScenes === undefined) {
    return { owned: true, visible: true };
  }

  const owned = ownedScenes[sceneId];
  if (!owned) {
    return { owned: false, visible: false };
  }

  return { owned: true, visible: owned.visible };
};
