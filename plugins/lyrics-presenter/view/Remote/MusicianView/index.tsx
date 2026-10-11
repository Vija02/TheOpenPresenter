import { Button } from "@repo/ui";
import { cx } from "class-variance-authority";
import { useEffect, useMemo, useRef, useState } from "react";
import { VscClose } from "react-icons/vsc";

import { songChart } from "../../../src/musician/chart";
import { usePluginAPI } from "../../pluginApi";
import { ChordChart } from "./ChordChart";
import { SettingsPanel } from "./SettingsPanel";
import { SongNavigation } from "./SongNavigation";
import { SongTitle } from "./SongTitle";
import { TransposeControl } from "./TransposeControl";
import { THEMES } from "./chartParts";
import { useMusicianSettings } from "./useMusicianSettings";

type MusicianViewProps = {
  onClose: () => void;
};

/** Chord charts for the band. Moving between songs here never changes the screen */
export const MusicianView = ({ onClose }: MusicianViewProps) => {
  const pluginApi = usePluginAPI();
  const songs = pluginApi.scene.useData((x) => x.pluginData.songs);
  const liveSongId = pluginApi.renderer.useData((x) => x.songId);
  const liveIndex = pluginApi.renderer.useData((x) => x.currentIndex);
  const isOnScreen =
    pluginApi.renderer.useCurrentScene() === pluginApi.pluginContext.sceneId;

  const [isFollowing, setIsFollowing] = useState(true);
  const [pickedSongId, setPickedSongId] = useState<string | null>(null);

  const song = isFollowing
    ? songs.find((x) => x.id === liveSongId)
    : (songs.find((x) => x.id === pickedSongId) ?? songs[0]);
  const isLiveSong = !!song && song.id === liveSongId;
  const songIndex = song ? songs.indexOf(song) : -1;
  const previousSong = songIndex > 0 ? songs[songIndex - 1] : undefined;
  // With nothing live yet, the first song is next
  const nextSong = songs[songIndex + 1];

  const { settings, update, updateStyle, setStyleScope, setTranspose } =
    useMusicianSettings(song?.id ?? null);

  const transpose = song ? (settings.transpose[song.id] ?? 0) : 0;
  const chart = useMemo(
    () => (song ? songChart(song, transpose) : null),
    [song, transpose],
  );

  const pick = (songId: string) => {
    // Picking what's live is the same as following it
    if (songId === liveSongId && settings.followVisual) {
      setIsFollowing(true);
    } else {
      setIsFollowing(false);
      setPickedSongId(songId);
    }
  };

  // With follow visual off, stay on whatever was live
  useEffect(() => {
    if (settings.followVisual || !isFollowing) return;
    setPickedSongId(liveSongId ?? null);
    setIsFollowing(false);
  }, [settings.followVisual, isFollowing, liveSongId]);

  // Refollow only as the live song changes, so turning Follow off sticks
  const shownSongId = song?.id;
  const refollow = settings.followVisual && settings.autoFollow;
  const lastLiveSongId = useRef(liveSongId);
  useEffect(() => {
    const changed = liveSongId !== lastLiveSongId.current;
    lastLiveSongId.current = liveSongId;
    if (changed && refollow && !isFollowing && shownSongId === liveSongId) {
      setIsFollowing(true);
    }
  }, [refollow, isFollowing, shownSongId, liveSongId]);

  const toggleFollowing = () => {
    if (isFollowing) {
      setPickedSongId(shownSongId ?? null);
      setIsFollowing(false);
    } else {
      setIsFollowing(true);
    }
  };

  const title = (
    <SongTitle
      songs={songs}
      song={song}
      liveSongId={liveSongId}
      onPick={pick}
    />
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // A popover handles its own Escape
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      data-testid="ly-musician-view"
      className={cx(
        "fixed inset-0 z-50 flex flex-col bg-surface-primary text-primary",
        settings.theme === "dark" && "dark [color-scheme:dark]",
      )}
    >
      <div className="flex shrink-0 items-start gap-2 border-b border-stroke px-2 py-2 sm:px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          title="Close musician view"
          aria-label="Close musician view"
        >
          <VscClose />
        </Button>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          {song && chart && (
            <TransposeControl
              originalKey={chart.originalKey}
              transpose={transpose}
              disabled={!chart.hasChords}
              onChange={(semitones) => setTranspose(song.id, semitones)}
            />
          )}

          <SettingsPanel
            settings={settings}
            onChange={update}
            onStyleChange={updateStyle}
            onStyleScopeChange={setStyleScope}
            hasSong={!!song}
            hasChords={!!chart?.hasChords}
          />

          {settings.followVisual && (
            <Button
              data-testid="ly-musician-follow"
              variant={isFollowing ? "warning" : "outline"}
              size="sm"
              aria-pressed={isFollowing}
              onClick={toggleFollowing}
              title={
                isOnScreen
                  ? undefined
                  : "This scene isn't on the screen right now"
              }
            >
              <span
                className={cx(
                  "size-2 rounded-full",
                  isOnScreen ? "bg-current" : "border border-current",
                )}
              />
              Follow
            </Button>
          )}
        </div>
      </div>

      <div
        className={cx(
          "flex min-h-0 flex-1 flex-col",
          THEMES[settings.theme].chart,
        )}
      >
        {song && chart ? (
          <ChordChart
            header={title}
            songId={song.id}
            chart={chart}
            liveIndex={settings.followVisual && isLiveSong ? liveIndex : null}
            followLive={isFollowing && settings.autoScroll}
            showChords={settings.showChords}
            fontSize={settings.fontSize}
            theme={settings.theme}
            autoFit={settings.autoFit}
          />
        ) : (
          <>
            {songs.length > 0 && (
              <div className="shrink-0 px-4 pt-4 sm:px-8">{title}</div>
            )}
            <div className="flex flex-1 items-center justify-center p-6 text-center opacity-60">
              {songs.length === 0
                ? "There are no songs yet."
                : "Nothing is live yet. Pick a song to look ahead."}
            </div>
          </>
        )}
      </div>

      {songs.length > 0 && (
        <SongNavigation
          previousSong={previousSong}
          nextSong={nextSong}
          transpose={settings.transpose}
          onPick={pick}
        />
      )}
    </div>
  );
};
