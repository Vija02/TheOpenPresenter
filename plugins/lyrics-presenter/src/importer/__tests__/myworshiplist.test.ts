import { describe, expect, it } from "vitest";

import { convertMWLData } from "../myworshiplist";

/**
 * Fixtures are the raw `content` field returned by the MyWorshipList API
 * Sources:
 *   - "Who Else" (id 2175) -> https://myworshiplist.com/songs/who-else-chords
 *   - "Praise"  (id 2074) -> https://myworshiplist.com/songs/praise-chords
 */
const WHO_ELSE = `Intro:<br>|x00 / / / |<br><br>VERSE 1:<br>  x00               x07<br>I am an instrument of exaltation<br>    x09m7             x07<br>And I was born to lift Your name above all names<br>   x00               x07<br>You hear the melody of all creation<br>  x09m7               x07<br>But there's a song of praise that only I can bring<br><br>CHORUS:<br>      x00            x02m7<br>Who else is worthy? Who else is worthy?<br>    x09m7           x052<br>There is no one, only You, Jesus<br>      x00            x02m7<br>Who else is worthy? Who else is worthy?<br>    x09m7           x052<br>There is no one, only You, Jesus<br><br>VERSE 2:<br>   x00               x07<br>You are the infinite God of the ages<br>    x09m7             x07<br>Yet You chose to make my heart Your dwelling place<br>   x00               x07<br>You healed my brokenness, showed me Your glory<br>  x09m7               x07<br>So I have songs of thanks not even angels sing<br><br>BRIDGE 1:<br>     x052            x07<br>Lamb of God, anointed one<br>     x09m7<br>Who was and is and is to come<br>    x00sus    x00      x07<br>Seated on the throne above<br>Ho-ly, ho-ly<br><br>     x052            x07<br>Righteous One who shed His blood<br>     x09m7<br>You proved to us the Father's love<br>    x00sus    x00      x07<br>Jesus Christ, be lifted up<br>Ho-ly, ho-ly<br><br>TAG:<br>    x09m7           x052<br>There is no one, only You, Jesus<br>    x09m7           x052<br>There is no one, only You, Jesus`;
const PRAISE = `VAMP<br>Let everything that has breath<br>Praise the Lord<br>Praise the Lord<br><br>VERSE 1<br>x00<br>I’ll praise in the valley<br>x05/x00 x00<br>Praise on the mountain<br> x07/x00<br>I’ll praise when I’m sure<br>x05/x00 x00<br>Praise when I’m doubting<br>x00<br>I’ll praise when outnumbered<br>x05/x00 x00<br>Praise when surrounded<br> x07/x11 x05/x00<br>Cause praise is the waters<br> x00<br>My enemies drown in<br><br>PRE-CHORUS<br> x07<br>As long as I’m breathing<br>x05<br>I’ve got a reason to<br><br>CHORUS<br>x09m x05 x00<br>Praise the Lord<br> x07<br>Oh my soul<br>x09m x05 x00<br>Praise the Lord<br> x07<br>Oh my soul<br><br>VERSE 2<br>x00<br>I’ll praise when I feel it<br>x05/x00 x00<br>I’ll praise when I don’t<br> x07/x00<br>I’ll praise cause I know<br>x05/x00 x00<br>You’re still in control<br>x00<br>My praise is a weapon<br>x05/x00 x00<br>It’s more than a sound<br> x07/x11 x05/x00<br>My praise is the shout<br> x00<br>That brings Jericho down<br><br>BRIDGE<br>x00<br>I’ll praise cause you’re sovereign<br>Praise cause you reign<br>Praise cause you rose and defeated the grave<br>I’ll praise cause you’re faithful<br>Praise cause you’re true<br>Praise cause there’s nobody greater than you`;

describe("convertMWLData", () => {
  it("formats 'Who Else' (who-else-chords)", () => {
    expect(convertMWLData(WHO_ELSE)).toMatchSnapshot();
  });

  it("formats 'Praise' (praise-chords)", () => {
    expect(convertMWLData(PRAISE)).toMatchSnapshot();
  });
});
