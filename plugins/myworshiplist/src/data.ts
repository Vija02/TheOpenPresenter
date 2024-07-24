import axios from "axios";

const songCache: Record<number, any> = {};

export const getSongData = async (id: number) => {
  if (id in songCache) {
    return songCache[id];
  }

  const res = await axios(`https://myworshiplist.com/api/songs/${id}`);

  songCache[id] = res.data.data;
  return res.data.data;
};
