import { typeidUnboxed } from "typeid-js";

import { SavedPlaylist, Track } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { trpc } from "../trpc";
import { formatDuration } from "./formatDuration";
import { PlayerControls } from "./usePlayerControls";

// What makes a track the same song, since ids are regenerated on every load
const trackKey = (track: Track) =>
  track.type === "youtube" ? track.url : track.mediaName;

const isSameTracks = (a: Track[], b: Track[]) =>
  a.length === b.length && a.every((x, i) => trackKey(x) === trackKey(b[i]!));

// Fresh ids, so loading a playlist twice doesn't put the same id in the scene
const copyTracks = (tracks: Track[]): Track[] =>
  tracks.map((track) => ({
    ...JSON.parse(JSON.stringify(track)),
    id: typeidUnboxed("track"),
  }));

const totalDurationSeconds = (tracks: Track[]) =>
  tracks.reduce((sum, x) => sum + (x.metadata.duration ?? 0), 0);

export const tracksSummary = (tracks: Track[]) => {
  const duration = totalDurationSeconds(tracks);
  return [
    `${tracks.length} ${tracks.length === 1 ? "track" : "tracks"}`,
    duration > 0 ? formatDuration(duration) : null,
  ]
    .filter(Boolean)
    .join(" • ");
};

export const useSavedPlaylists = (controls: PlayerControls) => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;
  const mutableSceneData = pluginApi.scene.useValtioData();

  const tracks = pluginApi.scene.useData((x) => x.pluginData.tracks) ?? [];
  const linkedId =
    pluginApi.scene.useData((x) => x.pluginData.savedPlaylistId) ?? null;

  // Saved playlists belong to the organization, which public visitors aren't in
  const listQuery = trpc.musicPlayer.savedPlaylists.list.useQuery(
    { pluginId },
    { enabled: !pluginApi.isPublicAccess },
  );
  const refetch = () => void listQuery.refetch();
  const createMutation = trpc.musicPlayer.savedPlaylists.create.useMutation({
    onSuccess: refetch,
  });
  const updateMutation = trpc.musicPlayer.savedPlaylists.update.useMutation({
    onSuccess: refetch,
  });
  const removeMutation = trpc.musicPlayer.savedPlaylists.remove.useMutation({
    onSuccess: refetch,
  });

  const playlists = listQuery.data ?? [];
  // A playlist deleted elsewhere leaves the scene unlinked
  const linked = playlists.find((x) => x.id === linkedId) ?? null;
  const hasUnsavedChanges = !!linked && !isSameTracks(linked.tracks, tracks);

  const setLinkedId = (id: string | null) => {
    mutableSceneData.pluginData.savedPlaylistId = id;
  };

  const load = (playlist: SavedPlaylist) => {
    controls.replaceTracks(copyTracks(playlist.tracks));
    setLinkedId(playlist.id);
  };

  const discardChanges = () => {
    if (linked) load(linked);
  };

  // Starts over, so what comes next isn't counted as an edit of the old one
  const clear = () => {
    controls.replaceTracks([]);
    setLinkedId(null);
  };

  const append = (playlist: SavedPlaylist) => {
    controls.addTracks(copyTracks(playlist.tracks));
  };

  const saveAs = async (name: string) => {
    try {
      const playlist = await createMutation.mutateAsync({
        pluginId,
        name,
        tracks: JSON.parse(JSON.stringify(tracks)),
      });
      setLinkedId(playlist.id);
      pluginApi.remote.toast.success(`Saved "${playlist.name}"`);
    } catch (err) {
      pluginApi.log.warn({ err }, "Failed to save playlist");
      pluginApi.remote.toast.error("Couldn't save the playlist");
    }
  };

  const saveChanges = async () => {
    if (!linked) return;
    try {
      await updateMutation.mutateAsync({
        pluginId,
        id: linked.id,
        tracks: JSON.parse(JSON.stringify(tracks)),
      });
    } catch (err) {
      pluginApi.log.warn({ err }, "Failed to update playlist");
      pluginApi.remote.toast.error("Couldn't save the playlist");
    }
  };

  const rename = async (id: string, name: string) => {
    try {
      await updateMutation.mutateAsync({ pluginId, id, name });
    } catch (err) {
      pluginApi.log.warn({ err }, "Failed to rename playlist");
      pluginApi.remote.toast.error("Couldn't rename the playlist");
    }
  };

  const remove = async (id: string) => {
    try {
      await removeMutation.mutateAsync({ pluginId, id });
      if (id === linkedId) setLinkedId(null);
    } catch (err) {
      pluginApi.log.warn({ err }, "Failed to delete playlist");
      pluginApi.remote.toast.error("Couldn't delete the playlist");
    }
  };

  return {
    playlists,
    isLoading: listQuery.isLoading,
    linked,
    hasUnsavedChanges,
    isSaving: createMutation.isPending || updateMutation.isPending,
    load,
    discardChanges,
    clear,
    append,
    saveAs,
    saveChanges,
    rename,
    remove,
  };
};

export type SavedPlaylists = ReturnType<typeof useSavedPlaylists>;
