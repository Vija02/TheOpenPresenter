import axios from "axios";

export const getSongData = async (id: number) => {
  const res = await axios(`https://myworshiplist.com/api/songs/${id}`);

  return res.data.data;
};
