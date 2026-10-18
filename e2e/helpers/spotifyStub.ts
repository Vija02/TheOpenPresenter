import type { BrowserContext } from "@playwright/test";

export type StubSpotifyTrack = {
  title: string;
  artist: string;
  /** In seconds */
  duration: number;
};

export type StubSpotifyCollection = {
  /** Matched against the pasted link */
  id: string;
  name: string;
  tracks: StubSpotifyTrack[];
};

export type StubYoutubeCandidate = {
  videoId: string;
  title: string;
  author: string;
  duration: number;
  /** 0 to 1, how sure the match is */
  score: number;
};

/**
 * Stands in for reading Spotify and matching on YouTube, so the specs don't
 * depend on either. Links answer from `collections` by id, and each track's
 * candidates come from `candidates` by title, none when missing
 */
export const stubSpotify = async (
  context: BrowserContext,
  collections: StubSpotifyCollection[],
  candidates: Record<string, StubYoutubeCandidate[]>,
) => {
  await context.route(/\/trpc\/musicPlayer\./, (route) => {
    const request = route.request();
    const procedures = new URL(request.url()).pathname
      .split("/")
      .pop()!
      .split(",");
    if (!procedures.every((x) => x.startsWith("musicPlayer.spotify"))) {
      return route.fallback();
    }
    const inputs = request.postDataJSON();

    const body = procedures.map((procedure, i) => {
      const input = inputs[i];
      if (procedure === "musicPlayer.spotifyCollection") {
        const collection = collections.find((x) => input?.url?.includes(x.id));
        if (!collection) {
          return { error: { message: "Not found", code: -32603, data: {} } };
        }
        return {
          result: {
            data: {
              type: "playlist",
              name: collection.name,
              tracks: collection.tracks,
              isTruncated: false,
            },
          },
        };
      }

      return {
        result: {
          data: {
            matches: (input?.tracks ?? []).map((track: StubSpotifyTrack) =>
              (candidates[track.title] ?? []).map((x) => ({
                ...x,
                thumbnailUrl: `https://i.ytimg.com/vi/${x.videoId}/hqdefault.jpg`,
              })),
            ),
          },
        },
      };
    });

    return route.fulfill({ status: 200, json: body });
  });
};
