import { describe, expect, it } from "vitest";

import { stripInlineChords } from "../../chords/chordpro";
import { convertMWLData, convertMWLDataDetailed } from "../myworshiplist";

/**
 * Fixtures are the raw `content` field returned by the MyWorshipList API
 * Sources:
 *   - "Hosanna" (id 10) -> https://myworshiplist.com/songs/hosanna-chords
 *   - "King of Kings" (id 2133) -> https://myworshiplist.com/songs/king-of-kings-chords
 *   - "Captain" (id 174) -> https://myworshiplist.com/songs/captain-chords
 */
const HOSANNA =
  "Intro<br>x09m  x00  x02m  x04m<br>            <br>Verse 1<br>x00                               <br>I see the King of glory<br>x09m                                      <br>Coming on the clouds with fire<br>                         x02m     <br>The whole earth shakes<br>                                    x07             <br>The whole earth shakes<br>x00                                   <br>I see His love and mercy<br>x09m                             <br>Washing over all our sin<br>                  x02m <br>The people sing<br>                  x07     <br>The people sing<br>           <br>Chorus<br>x00       x05   x07        x09m<br>Hosanna hosanna<br>          x05            x09m      x07  <br>Hosanna in the highest<br>     x00     x05   x07        x09m<br>Hosanna hosanna<br>     x05                 x07        x00<br>Hosanna in the highest<br>             <br>Verse 2<br>x00                         <br>I see a generation<br>x09m                                   <br>Rising up to take their place<br>                     x02m <br>With selfless faith<br>                        x07 <br>With selfless faith<br>x00                          <br>I see a near revival<br>x09m                                    <br>Stirring as we pray and seek<br>                     x02m    <br>We're on our knees<br>                     x07        <br>We're on our knees<br>          <br>Bridge<br>x05                                            x07       <br>Heal my heart and make it clean<br>x00                                   x09m               <br>Open up my eyes to the things unseen<br>x05                                       x07                          x09m<br>Show me how to love like You have loved me<br>x05                                                    x07       <br>Break my heart for what breaks Yours<br>x00                                   x09m                   <br>Everything I am for Your Kingdom's cause<br>x05                               x07              x05<br>As I walk from earth into eternity<br>";
const KING_OF_KINGS =
  "[Verse 1]<br>       x00                x05<br>In the darkness we were waiting<br>        x07            x00<br>Without hope without light<br>          x00               x05<br>Till from heaven You came running<br>          x07              x00<br>There was mercy in Your eyes<br>   x00                  x05<br>To fulfil the law and prophets<br>      x07              x00<br>To a virgin came the Word<br>       x00                 x05<br>From a throne of endless glory<br>      x07            x00<br>To a cradle in the dirt<br><br>[Chorus]<br>x00<br>Praise the Father<br>x05<br>Praise the Son<br>x09m                x07<br>Praise the Spirit three in one<br>x00<br>God of glory<br>x05<br>Majesty<br>x09m        x05           x07       x00<br>Praise forever to the King of Kings<br><br>[Verse 2]<br>   x00                  x05<br>To reveal the kingdom coming<br>        x07            x00<br>And to reconcile the lost<br>   x00                 x05<br>To redeem the whole creation<br>         x07              x00<br>You did not despise the cross<br>    x00             x05<br>For even in Your suffering<br>        x07            x00<br>You saw to the other side<br>        x00                x05<br>Knowing this was our salvation<br>      x07                x00<br>Jesus for our sake You died<br><br>[Verse 3]<br>        x09m               x05<br>And the morning that You rose<br>        x07              x00<br>All of heaven held its breath<br>          x09m                  x05<br>Till that stone was moved for good<br>        x07                  x00<br>For the Lamb had conquered death<br>        x09m                   x05<br>And the dead rose from their tombs<br>        x07               x00<br>And the angels stood in awe<br>        x09m                 x05<br>For the souls of all who\u2019d come<br>        x07            x00<br>To the Father are restored<br><br>[Verse 4]<br>        x00                    x05<br>And the Church of Christ was born<br>         x07              x00<br>Then the Spirit lit the flame<br>         x00               x05<br>Now this gospel truth of old<br>          x07               x00<br>Shall not kneel shall not faint<br>       x00                x05<br>By His blood and in His Name<br>        x07            x00<br>In His freedom I am free<br>                      x05<br>For the love of Jesus Christ<br>         x07          x00<br>Who has resurrected me";

const CAPTAIN =
  "Intro <br>| x00 /// | x02m / x00 / | x05 /// |                                          <br>| x05 / x02m / | x00 /// | x02m / x00/x04 / |      <br>| x05 /// | <br>          <br>Verse<br>x02m         x00                               x02m         x00          <br>Through waters uncharted my soul will embark<br>x09m         x07                          x05     x00           <br>I'll follow Your voice straight into the dark<br>                                         x02m        x00        <br>And if from the course You intend I depart<br>x09m                x07               x05               x00      <br>Speak to the sails of my wandering heart<br>           <br>Chorus<br>              x05                x00          <br>Like the wind, You'll  guide. <br>               x09m7             x07   <br>Clear the skies before me<br>            x05            x00 x07/x11x09m  <br>And I'll glide this open sea<br>              x05               x00              x09m7      x07        <br>Like the stars Your word will align my voyage<br>       x05               x00         x07/x11x09m   <br>and remind me where I've been<br>       x05                x07      <br>and where I am going<br>         <br>Verse 2<br>x00                             x02m              x00          <br>Lost in the shallows amidst fear and fog<br>         x09m                   x07                 x05                      x00      <br>Your truth is the compass that points me back north<br>                                   x02m            x00          <br>Jesus my Captain, my soul's trusted Lord<br>x09m          x07              x05     x00              <br>All my allegiance is rightfully Yours<br>           <br>Outro<br>x00                                 x02m            x00          <br>Jesus my Captain, my soul's trusted Lord<br>x09m          x07              x05     x00              <br>All my allegiance is rightfully Yours";

describe("convertMWLData", () => {
  it("formats 'Hosanna' (hosanna-chords)", () => {
    expect(convertMWLData(HOSANNA, { key: "E" })).toMatchSnapshot();
  });

  it("formats 'King of Kings' (king-of-kings-chords)", () => {
    expect(convertMWLData(KING_OF_KINGS, { key: "D" })).toMatchSnapshot();
  });

  it("detects how each sheet was aligned", () => {
    // "King of Kings" was typed in a monospace font; "Hosanna" was aligned
    // against the site's Arial rendering.
    expect(convertMWLDataDetailed(KING_OF_KINGS, { key: "D" }).alignment).toBe(
      "mono",
    );
    expect(convertMWLDataDetailed(HOSANNA, { key: "E" }).alignment).toBe(
      "proportional",
    );
  });

  it("keeps a chord where the sheet put it, mid-word included", () => {
    const result = convertMWLData(KING_OF_KINGS, { key: "D" });

    expect(result).toContain("There was [A]mercy in Your e[D]yes");
  });

  it("keeps a bar-line intro as an OpenSong chord line", () => {
    // "| x00 /// | x02m / x00 / |" has no lyric under it, so inlining it would
    // turn the bars and slashes into lyrics.
    const result = convertMWLData(CAPTAIN, { key: "D" });

    expect(result).toContain(".| D /// | Em / D / | G /// |");
  });

  it("decodes placeholders into real chords in the song's key", () => {
    const result = convertMWLData(KING_OF_KINGS, { key: "D" });

    expect(result).toContain("[D]");
    expect(result).toContain("[Bm]");
    expect(result).not.toContain("x00");
  });

  it("never alters the lyrics", () => {
    const lyrics = convertMWLData(HOSANNA, { key: "E" })
      .split("\n")
      .map(stripInlineChords);

    expect(lyrics).toContain("I see the King of glory");
    expect(lyrics).toContain("Coming on the clouds with fire");
  });

  it("can still emit the OpenSong format", () => {
    const result = convertMWLData(KING_OF_KINGS, {
      key: "D",
      format: "opensong",
    });

    expect(result).toContain(".");
    expect(result).toContain("x00");
  });

  it("uses the source key rather than guessing from the chords", () => {
    // "Hosanna" is in E but opens on an intro line with no lyric under it, so
    // guessing would be unreliable. The source key decides the spelling.
    const result = convertMWLData(HOSANNA, { key: "E" });

    expect(result).toContain("[E]");
    expect(result).toContain("[C#m]");
    // E is a sharp key, so nothing should be spelled with flats.
    expect(result).not.toMatch(/\[[A-G]b/);
  });
});
