import type { PluginSample } from "@repo/base-types";

import type { PluginBaseData, PluginRendererData } from "./types";

const SONG_ID = "sample-song";

const pluginData: PluginBaseData = {
  songs: [
    {
      id: SONG_ID,
      title: "Amazing Grace",
      author: "John Newton",
      content: `[Verse 1]
Amazing grace, how sweet the sound
That saved a wretch like me
I once was lost, but now am found
Was blind, but now I see

[Verse 2]
'Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed

[Verse 3]
Through many dangers, toils and snares
I have already come
'Tis grace hath brought me safe thus far
And grace will lead me home

[Verse 4]
The Lord has promised good to me
His word my hope secures
He will my shield and portion be
As long as life endures

[Verse 5]
Yea, when this flesh and heart shall fail
And mortal life shall cease
I shall possess within the veil
A life of joy and peace

[Verse 6]
When we've been there ten thousand years
Bright shining as the sun
We've no less days to sing God's praise
Than when we'd first begun`,
      setting: { displayType: "sections", sectionOrder: null },
      looks: {},
      _imported: false,
    },
  ],
  looks: {},
};

const rendererData: PluginRendererData = {
  songId: SONG_ID,
  // Partway in, so the whole song view shows what's live among the rest
  currentIndex: 1,
  backgroundRun: null,
};

/** A well-known hymn, all six verses, on its second */
export const sample: PluginSample = { pluginData, rendererData };
