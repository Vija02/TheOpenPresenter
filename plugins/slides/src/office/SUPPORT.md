# PowerPoint support

What plays when a .pptx is shown in the **PowerPoint** display mode. How it
works is in `docs/OFFICE-ONLINE-SLIDESHOW.md`; the code is in this folder and
`view/Renderer/PowerPointRenderer/`.

**Yes**: plays as in PowerPoint. **Approx.**: plays, but differs visibly.
**No**: shown still, or falls back as noted.

## Importing

|                                                       |                                                                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| .pptx / .ppt                                          | Yes. Converted by PowerPoint for the web, so the file must be reachable from the internet at import (as for the PDF) |
| Look of the slides (fonts, SmartArt, charts, effects) | Yes. Microsoft renders every shape                                                                                   |
| Resolution                                            | Up to 1920×1080. Larger outputs are upscaled                                                                         |
| Showing it offline                                    | Yes, once imported. Nothing calls Microsoft during a show                                                            |
| Hidden slides                                         | Left out, as in a PowerPoint show                                                                                    |
| Speaker notes                                         | Yes, including in decks with hidden slides                                                                           |
| When the capture fails                                | The deck imports as still images (the **Image** mode)                                                                |
| Files PowerPoint for the web can't open               | Rejected within seconds with a clear message                                                                         |

Decks imported before a feature below was added keep what was captured then;
re-import to pick it up (Morph, letter builds, video, smaller WebP previews).

## Animations

### Timing

|                                                                      |                                                |
| -------------------------------------------------------------------- | ---------------------------------------------- |
| On click, with previous, after previous, delays, durations           | Yes                                            |
| Animations that start by themselves when the slide opens             | Yes                                            |
| Accelerate / decelerate                                              | Yes                                            |
| Repeat (a count, until next click, until end of slide), auto-reverse | Yes                                            |
| Rewind when done, hide after animation, hide on next click           | Yes                                            |
| Build by paragraph                                                   | Yes                                            |
| Build by word / letter                                               | Yes                                            |
| Triggers (start when a shape is clicked)                             | No: nothing on an output screen can be clicked |
| Bookmark triggers in media                                           | No                                             |

### Entrance and exit effects

**Yes:** Appear, Fade, Fly In/Out, Wipe, Split, Box, Plus, Peek, Stretch,
Swivel, Zoom, Faded Zoom, Boomerang, Float In/Out (Ascend/Descend), Float,
Grow & Turn, Rise Up, Swish, Thin Line, Unfold, Whip, Sling, Spinner,
Pinwheel, Compress, Expand, Zip, Glide, Flip, Fold, Credits, Ease In,
Flash Once, Crawl and Light Speed (as Fly).

**Approx.:** Blinds, Checkerboard and Random Bars (even slats), Strips (a soft
diagonal wipe), Dissolve (a fade), Arc Up (simplified path).

**As in PowerPoint for the web, which plays these differently itself:**
Circle and Diamond play as Box; Wheel and Wedge as Box In; Spiral, Bounce,
Random, Colour Reveal, Centre Revolve and anything unknown as Fade.

### Emphasis effects

**Yes:** Grow/Shrink, Spin, Transparency, Pulse, Teeter, Wave, Blink, Shimmer,
Vertical Highlight.

**Approx.:** colour changes (Fill, Line and Font Colour, Darken, Lighten,
Desaturate, Complementary, Contrasting, Colour Blend) fade to Microsoft's
pre-rendered result rather than blending colours; font and style changes swap
at once; Bold Reveal and Font Size play as Grow; Brush On Colour/Underline,
Colour Wave and Grow With Colour play as Shimmer; Blast as Vertical Highlight.

### Motion paths

|                                                |     |
| ---------------------------------------------- | --- |
| Lines and curves, reversed paths, auto-reverse | Yes |
| Orient shape to path                           | No  |

## Transitions

|                                                                                                                                                                               |                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Fade, Fade Through Black, Push, Cover, Uncover, Wipe, Strips, Split, Box, Diamond, Plus, Circle, Wedge, Wheel, Blinds, Checkerboard, Random Bars, Comb, Newsflash, Flip, Cube | Yes, with their duration and direction                                                                  |
| Morph                                                                                                                                                                         | Approx.: objects move, resize, turn and crossfade; shapes don't bend into each other (square to circle) |
| Vortex, Ripple, Honeycomb, Glitter, Shred, Page Curl, Curtains, Fracture and the other 3D/"exciting" transitions                                                              | No: a 700ms fade, as PowerPoint for the web does                                                        |
| Going back a slide                                                                                                                                                            | Plays the transition in reverse                                                                         |
| Transition sounds                                                                                                                                                             | No                                                                                                      |

## Video and audio

|                                                               |                                               |
| ------------------------------------------------------------- | --------------------------------------------- |
| Embedded video, on its animation step or when the slide opens | Yes, with its volume, trimming and looping    |
| Every output in step                                          | Yes                                           |
| Pause, restart or seek from the remote                        | No                                            |
| Jumping to a slide after its video started                    | Shows the poster frame                        |
| Linked (not embedded) video                                   | Only if the link is reachable from the output |
| Sound playing across slides, background music                 | No                                            |

## Moving through a show

|                                                            |                                             |
| ---------------------------------------------------------- | ------------------------------------------- |
| Next/previous step through every click, like PowerPoint    | Yes, from the remote, keyboard and clickers |
| Presenter view previews of the next/previous step          | Yes                                         |
| Jumping to any slide                                       | Yes, landing with its builds settled        |
| Advance after N seconds, rehearsed timings, loop until Esc | No                                          |
| Custom shows                                               | No: the whole deck plays                    |
| Hyperlinks, action buttons, Zoom slides                    | No: they show, but do nothing               |
