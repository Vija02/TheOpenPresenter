import type { BrowserContext } from "@playwright/test";

export type StubVideo = {
  /** 11 characters, like a real YouTube id */
  videoId: string;
  title: string;
  author: string;
  /** In seconds */
  duration: number;
};

export type StubPlaylist = {
  playlistId: string;
  title: string;
  videos: StubVideo[];
};

const toResult = (video: StubVideo) => ({
  ...video,
  durationText: `0:${String(video.duration).padStart(2, "0")}`,
  thumbnailUrl: `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
});

/**
 * Stands in for YouTube, so the specs don't depend on its search results or
 * on real playback. The music player's tRPC calls answer from `videos`, and
 * the embedded player loads a blank page. Its iframe still points at the
 * video, which is how the specs tell what the screen is playing.
 */
export const stubYoutube = async (
  context: BrowserContext,
  videos: StubVideo[],
  playlists: StubPlaylist[] = [],
) => {
  await context.route(/\/trpc\/musicPlayer\./, (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const procedures = url.pathname.split("/").pop()!.split(",");
    // Queries send their input in the url, mutations in the body
    const inputs =
      request.method() === "GET"
        ? JSON.parse(url.searchParams.get("input") ?? "{}")
        : request.postDataJSON();

    const body = procedures.map((procedure, i) => {
      if (procedure === "musicPlayer.search") {
        return { result: { data: { results: videos.map(toResult) } } };
      }

      const playlist = playlists.find(
        (x) => x.playlistId === inputs[i]?.playlistId,
      );
      if (procedure === "musicPlayer.youtubePlaylist" && playlist) {
        return {
          result: {
            data: {
              title: playlist.title,
              videos: playlist.videos.map(toResult),
              isTruncated: false,
            },
          },
        };
      }

      const video = videos.find((x) => inputs[i]?.url?.includes(x.videoId));
      if (procedure === "musicPlayer.youtubeMetadata" && video) {
        return { result: { data: toResult(video) } };
      }
      return { error: { message: "Not stubbed", code: -32603, data: {} } };
    });

    return route.fulfill({ status: 200, json: body });
  });

  await context.route(
    /^https:\/\/([\w-]+\.)?(youtube\.com|ytimg\.com)\//,
    (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "" }),
  );
};
