export type RadioStation = {
  title: string;
  webLink: string;
  coverUrl: string;
  url: string;
};

export const hostnameOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const findStation = (url: string | null) =>
  [...worshipRadios, ...venueRadios].find((x) => x.url === url);

// TODO: Pull from API
export const worshipRadios: RadioStation[] = [
  {
    title: "Worship Radio 247",
    webLink: "https://worshipradio247.org",
    coverUrl: "",
    url: "https://uk3-vn.mixstream.net/:8010/listen.mp3",
  },
  {
    title: "AllWorship Christmas Worship",
    webLink: "https://www.allworship.com",
    coverUrl: "",
    url: "https://ice66.securenetsystems.net/AGCXW",
  },
  {
    title: "AllWorship Instrumental Worship",
    webLink: "https://www.allworship.com",
    coverUrl: "",
    url: "https://ice66.securenetsystems.net/AGCIW",
  },
  {
    title: "AllWorship Contemporary Worship",
    webLink: "https://www.allworship.com",
    coverUrl: "",
    url: "https://ice66.securenetsystems.net/AGCCW",
  },
  {
    title: "AllWorship Praise & Worship",
    webLink: "https://www.allworship.com",
    coverUrl: "",
    url: "https://ice66.securenetsystems.net/AGCPW",
  },
  {
    title: "AllWorship Gospel Worship",
    webLink: "https://www.allworship.com",
    coverUrl: "",
    url: "https://ice25.securenetsystems.net/AGCGW",
  },
  {
    title: "AllWorship Hymns & Favorites",
    webLink: "https://www.allworship.com",
    coverUrl: "",
    url: "https://ice25.securenetsystems.net/AGCHF",
  },
  {
    title: "Power of Worship Radio",
    webLink: "https://www.powerofworship.net",
    coverUrl: "",
    url: "https://stream.aiir.com/rwvbhh4xsgpuv",
  },
];

export const venueRadios: RadioStation[] = [
  {
    title: "BBC World Service",
    webLink: "https://www.bbc.co.uk/worldserviceradio",
    coverUrl: "",
    url: "http://stream.live.vc.bbcmedia.co.uk/bbc_world_service",
  },
  // Radio Paradise
  {
    title: "Radio Paradise (Eclectic Mix)",
    webLink: "https://radioparadise.com",
    coverUrl: "",
    url: "https://stream.radioparadise.com/aac-320",
  },
  {
    title: "Radio Paradise Mellow Mix",
    webLink: "https://radioparadise.com",
    coverUrl: "",
    url: "https://stream.radioparadise.com/mellow-320",
  },
  {
    title: "Radio Paradise Rock Mix",
    webLink: "https://radioparadise.com",
    coverUrl: "",
    url: "https://stream.radioparadise.com/rock-320",
  },
  {
    title: "Radio Paradise Global Mix",
    webLink: "https://radioparadise.com",
    coverUrl: "",
    url: "https://stream.radioparadise.com/global-320",
  },
  // KEXP
  {
    title: "KEXP 90.3 FM Seattle",
    webLink: "https://www.kexp.org",
    coverUrl: "",
    url: "https://kexp-mp3-128.streamguys1.com/kexp128.mp3",
  },
  // SomaFM
  {
    title: "SomaFM Groove Salad (Ambient/Downtempo)",
    webLink: "https://somafm.com/groovesalad",
    coverUrl: "",
    url: "https://ice1.somafm.com/groovesalad-128-mp3",
  },
  {
    title: "SomaFM Drone Zone (Ambient)",
    webLink: "https://somafm.com/dronezone",
    coverUrl: "",
    url: "https://ice1.somafm.com/dronezone-128-mp3",
  },
  {
    title: "SomaFM Indie Pop Rocks!",
    webLink: "https://somafm.com/indiepop",
    coverUrl: "",
    url: "https://ice1.somafm.com/indiepop-128-mp3",
  },
  {
    title: "SomaFM Lush (Mellow Vocals)",
    webLink: "https://somafm.com/lush",
    coverUrl: "",
    url: "https://ice1.somafm.com/lush-128-mp3",
  },
  {
    title: "SomaFM Deep Space One (Deep Ambient)",
    webLink: "https://somafm.com/deepspaceone",
    coverUrl: "",
    url: "https://ice1.somafm.com/deepspaceone-128-mp3",
  },
  {
    title: "SomaFM Secret Agent (Spy Lounge)",
    webLink: "https://somafm.com/secretagent",
    coverUrl: "",
    url: "https://ice1.somafm.com/secretagent-128-mp3",
  },
  {
    title: "SomaFM Underground 80s",
    webLink: "https://somafm.com/u80s",
    coverUrl: "",
    url: "https://ice1.somafm.com/u80s-128-mp3",
  },
  {
    title: "SomaFM Beat Blender (Deep House)",
    webLink: "https://somafm.com/beatblender",
    coverUrl: "",
    url: "https://ice1.somafm.com/beatblender-128-mp3",
  },
  {
    title: "SomaFM Boot Liquor (Americana)",
    webLink: "https://somafm.com/bootliquor",
    coverUrl: "",
    url: "https://ice1.somafm.com/bootliquor-128-mp3",
  },
  {
    title: "SomaFM Folk Forward",
    webLink: "https://somafm.com/folkfwd",
    coverUrl: "",
    url: "https://ice1.somafm.com/folkfwd-128-mp3",
  },
  {
    title: "SomaFM Left Coast 70s",
    webLink: "https://somafm.com/seventies",
    coverUrl: "",
    url: "https://ice1.somafm.com/seventies-128-mp3",
  },
  {
    title: "SomaFM Metal Detector",
    webLink: "https://somafm.com/metal",
    coverUrl: "",
    url: "https://ice1.somafm.com/metal-128-mp3",
  },
  {
    title: "SomaFM PopTron (Electropop)",
    webLink: "https://somafm.com/poptron",
    coverUrl: "",
    url: "https://ice1.somafm.com/poptron-128-mp3",
  },
  {
    title: "SomaFM Seven Inch Soul",
    webLink: "https://somafm.com/7soul",
    coverUrl: "",
    url: "https://ice1.somafm.com/7soul-128-mp3",
  },
  {
    title: "SomaFM Sonic Universe (Jazz Fusion)",
    webLink: "https://somafm.com/sonicuniverse",
    coverUrl: "",
    url: "https://ice1.somafm.com/sonicuniverse-128-mp3",
  },
  {
    title: "SomaFM Space Station Soma",
    webLink: "https://somafm.com/spacestation",
    coverUrl: "",
    url: "https://ice1.somafm.com/spacestation-128-mp3",
  },
  {
    title: "SomaFM Suburbs of Goa (Worldbeat)",
    webLink: "https://somafm.com/suburbsofgoa",
    coverUrl: "",
    url: "https://ice1.somafm.com/suburbsofgoa-128-mp3",
  },
  {
    title: "SomaFM The Trip (Progressive)",
    webLink: "https://somafm.com/thetrip",
    coverUrl: "",
    url: "https://ice1.somafm.com/thetrip-128-mp3",
  },
  {
    title: "SomaFM ThistleRadio (Celtic)",
    webLink: "https://somafm.com/thistle",
    coverUrl: "",
    url: "https://ice1.somafm.com/thistle-128-mp3",
  },
  {
    title: "SomaFM BAGeL Radio (Indie Rock)",
    webLink: "https://somafm.com/bagel",
    coverUrl: "",
    url: "https://ice1.somafm.com/bagel-128-mp3",
  },
  {
    title: "SomaFM DEF CON Radio",
    webLink: "https://somafm.com/defcon",
    coverUrl: "",
    url: "https://ice1.somafm.com/defcon-128-mp3",
  },
  {
    title: "SomaFM Mission Control",
    webLink: "https://somafm.com/missioncontrol",
    coverUrl: "",
    url: "https://ice1.somafm.com/missioncontrol-128-mp3",
  },
];
