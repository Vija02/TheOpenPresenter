import type { ServerPluginApi } from "@repo/base-plugin/server";
import { describe, expect, it } from "vitest";

import { formatLyricsStream, toChordLines } from "../ai/formatLyrics";

/** A model that answers `reply` in awkward chunks, and remembers its input. */
const fakeModel = (reply: string) => {
  const seen: { user?: string } = {};
  const api = {
    ai: {
      chatCompletionStream: async function* (
        messages: { role: string; content: string }[],
      ) {
        seen.user = messages.find((m) => m.role === "user")?.content;
        for (let i = 0; i < reply.length; i += 7) yield reply.slice(i, i + 7);
      },
    },
  } as unknown as ServerPluginApi;
  return { api, seen };
};

/** A chord line with each chord at the column where its word starts. */
const over = (lyric: string, chords: Record<string, string>) => {
  let line = "";
  for (const [word, chord] of Object.entries(chords)) {
    line = line.padEnd(lyric.indexOf(word), " ") + chord;
  }
  return "." + line;
};

const collect = async (gen: AsyncIterable<string>) => {
  let out = "";
  for await (const chunk of gen) out += chunk;
  return out;
};

describe("formatLyricsStream", () => {
  it("hands chords-above-the-line songs over as ChordPro and turns them back", async () => {
    const lyric = "Amazing grace, how sweet the sound";
    const song = [
      "[Verse]",
      over(lyric, { Amazing: "G", sweet: "D" }),
      lyric,
    ].join("\n");
    const { api, seen } = fakeModel(
      "[Verse]\n[G]Amazing grace,\nHow [D]sweet the sound",
    );

    const out = await collect(formatLyricsStream(api, song));

    expect(seen.user).toContain("[G]Amazing grace, how [D]sweet the sound");
    expect(out).toBe(
      [
        "[Verse]",
        over("Amazing grace,", { Amazing: "G" }),
        "Amazing grace,",
        over("How sweet the sound", { sweet: "D" }),
        "How sweet the sound",
      ].join("\n"),
    );
  });

  it("leaves ChordPro songs as ChordPro", async () => {
    const song = "[Verse]\nAmazing [G]grace";
    const reply = "[Verse]\nAmazing [G]grace";
    const { api, seen } = fakeModel(reply);

    expect(await collect(formatLyricsStream(api, song))).toBe(reply);
    expect(seen.user).toContain(song);
  });

  it("keeps instrumental chord lines as they are", async () => {
    const song = "[Intro]\n.| G /// | D /// |\n\n[Verse]\n.G\nAmazing grace";
    const { api, seen } = fakeModel(
      "[Intro]\n.| G /// | D /// |\n\n[Verse]\n[G]Amazing grace",
    );

    const out = await collect(formatLyricsStream(api, song));

    expect(seen.user).toContain(".| G /// | D /// |");
    expect(out).toBe(
      "[Intro]\n.| G /// | D /// |\n\n[Verse]\n.G\nAmazing grace",
    );
  });
});

describe("toChordLines", () => {
  it("converts whole lines however the text is chunked", async () => {
    async function* chunks() {
      yield "Amaz";
      yield "ing [G]gr";
      yield "ace\nHow [D]swe";
      yield "et";
    }
    expect(await collect(toChordLines(chunks()))).toBe(
      [
        over("Amazing grace", { grace: "G" }),
        "Amazing grace",
        over("How sweet", { sweet: "D" }),
        "How sweet",
      ].join("\n"),
    );
  });
});
