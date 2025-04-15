import { useQuery } from "@tanstack/react-query";
import { getAllWindows } from "@tauri-apps/api/window";

export const useAllWindows = () => {
  return useQuery({
    queryKey: ["allWindows"],
    queryFn: () => {
      return getAllWindows();
    },
  });
};
