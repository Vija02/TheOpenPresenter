import { PopoverContent } from "@repo/ui";

// TODO: Make this clearer & using modal/drawer
export const SongEditInfo = () => {
  return (
    <PopoverContent
      align="start"
      className="w-full max-w-screen text-white bg-blue-900 border border-blue-900"
    >
      <h3 className="text-lg font-black">Formatting songs</h3>
      We use quite a simple format to show songs inspired by OpenSong. <br />
      <br />
      <b>Here are some of the basic rules: </b>
      <br />
      <ol className="list-decimal list-inside">
        <li>
          Separate sections with square brackets(<b>[ ]</b>) like{" "}
          <b>[Verse 1]</b>.
          <br />
          This can be anything from Verse, Chorus, Bridge, and any text you
          like.
        </li>
        <li>
          Use a single dash(<b>-</b>) to split your section into multiple
          slides.
        </li>
        <li>
          Add a dot(<b>.</b>) in front of a line to indicate that it is a chord
          line.
          <br />
          Note: At this time, we do not support showing chords yet.
        </li>
      </ol>
    </PopoverContent>
  );
};
