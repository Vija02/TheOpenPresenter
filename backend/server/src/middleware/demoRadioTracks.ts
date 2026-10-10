/**
 * YouTube tracks seeded into the Music Player (radio) scene of the church
 * demo. Same shape as the radio plugin's `YoutubeTrack`.
 */
export type DemoRadioTrack = {
  id: string;
  type: "youtube";
  url: string;
  metadata: {
    title: string;
    author: string;
    duration: number;
    thumbnailUrl: string;
  };
};

export const DEMO_RADIO_TRACKS: DemoRadioTrack[] = [
  {
    id: "track_01m49jgv97espryrt8v7rnry7x",
    type: "youtube",
    url: "https://www.youtube.com/watch?v=uHz0w-HG4iU",
    metadata: {
      title:
        "Great Are You Lord - All Sons & Daughters (Official Live Concert)",
      author: "Integrity Music",
      duration: 302,
      thumbnailUrl:
        "https://i.ytimg.com/vi/uHz0w-HG4iU/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBC9C2uLwl8Ev9pYsHpEwU13C2wVg",
    },
  },
  {
    id: "track_01m4g6xpztfzz8n2msnjf7x99m",
    type: "youtube",
    url: "https://www.youtube.com/watch?v=nQWFzMvCfLE",
    metadata: {
      title: "What A Beautiful Name - Hillsong Worship",
      author: "Hillsong Worship",
      duration: 343,
      thumbnailUrl:
        "https://i.ytimg.com/vi/nQWFzMvCfLE/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBjebkXwQMdi4hiWMgj-f5XZGgT6g",
    },
  },
  {
    id: "track_01m4g6xqwvfzz8n2n2nz9hk3ag",
    type: "youtube",
    url: "https://www.youtube.com/watch?v=NS3OgXaHoyc",
    metadata: {
      title: "Grace To Grace - Hillsong Worship",
      author: "Hillsong Worship",
      duration: 424,
      thumbnailUrl:
        "https://i.ytimg.com/vi/NS3OgXaHoyc/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDTeqLUVAaXOvav29RwCGgspuFKPw",
    },
  },
  {
    id: "track_01m4g6y55dfzz8n2ndvedsm1ga",
    type: "youtube",
    url: "https://www.youtube.com/watch?v=_2nBOGA6X2g",
    metadata: {
      title: "Victor's Crown – Darlene Zschech (Official Live Video)",
      author: "Integrity Music",
      duration: 445,
      thumbnailUrl:
        "https://i.ytimg.com/vi/_2nBOGA6X2g/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBGk2_OgF0rsfslK3gti3YEY6MJ8Q",
    },
  },
  {
    id: "track_01m4g6ynxxfzz8n2nj2k1z2b1z",
    type: "youtube",
    url: "https://www.youtube.com/watch?v=5KiQDoWo5t4",
    metadata: {
      title: "You Are Good - Israel & New Breed",
      author: "Israel Houghton",
      duration: 265,
      thumbnailUrl:
        "https://i.ytimg.com/vi/5KiQDoWo5t4/hqdefault.jpg?sqp=-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB_gmAAtAFigIMCAAQARhlIFcoTjAP&rs=AOn4CLCcm0YSIcknWTdaguP_Cyk0_O4v5w",
    },
  },
  {
    id: "track_01m4g6yyeqfzz8n2ny307z8r58",
    type: "youtube",
    url: "https://www.youtube.com/watch?v=f2oxGYpuLkw",
    metadata: {
      title:
        "Praise (feat. Brandon Lake, Chris Brown & Chandler Moore) | Elevation Worship",
      author: "Elevation Worship",
      duration: 305,
      thumbnailUrl:
        "https://i.ytimg.com/vi/f2oxGYpuLkw/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBxcGJ4MLzxOXQvfOBmFRZYCP8zbA",
    },
  },
  {
    id: "track_01m4g6z261fzz8n2p2s1v9jamy",
    type: "youtube",
    url: "https://www.youtube.com/watch?v=mC-zw0zCCtg",
    metadata: {
      title: "Jireh | Elevation Worship & Maverick City",
      author: "Elevation Worship",
      duration: 599,
      thumbnailUrl:
        "https://i.ytimg.com/vi/mC-zw0zCCtg/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBgcFwwY1CIjlpOIA_AkIsssWb4lA",
    },
  },
  {
    id: "track_01m4g6zkkafzz8n2pch497acz8",
    type: "youtube",
    url: "https://www.youtube.com/watch?v=u-1fwZtKJSM",
    metadata: {
      title: "Phil Wickham - Living Hope (Official Music Video)",
      author: "Phil Wickham",
      duration: 332,
      thumbnailUrl:
        "https://i.ytimg.com/vi/u-1fwZtKJSM/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBbSvtuL_FMfQPw2thUI4pVyhGJQw",
    },
  },
  {
    id: "track_01m4g7011jfzz8n2ppv14zsfp5",
    type: "youtube",
    url: "https://www.youtube.com/watch?v=n0FBb6hnwTo",
    metadata: {
      title: "Goodness Of God (LIVE) - Jenn Johnson | VICTORY",
      author: "Bethel Music and Jenn Johnson",
      duration: 304,
      thumbnailUrl:
        "https://i.ytimg.com/vi/n0FBb6hnwTo/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBSHi1WXfQPs1rEG7Zvi-e50KIc1A",
    },
  },
  {
    id: "track_01m4g705mzfzz8n2ptep9petjv",
    type: "youtube",
    url: "https://www.youtube.com/watch?v=LbkdHR38Rgk",
    metadata: {
      title: "Jesus You're Beautiful - Bethel Music & David Funk",
      author: "Bethel Music and David Funk",
      duration: 923,
      thumbnailUrl:
        "https://i.ytimg.com/vi/LbkdHR38Rgk/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCkn-cDAE2YDanfKVSdyYrN8zQtsw",
    },
  },
];
