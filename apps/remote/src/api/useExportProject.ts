import { useMutation } from "@tanstack/react-query";
import axios from "axios";

export const useExportProject = (projectId: string) => {
  return useMutation({
    mutationKey: ["projectExport", projectId],
    mutationFn: () => {
      return axios.get(`/projectExport?projectId=${projectId}`, {
        responseType: "blob",
      });
    },
  });
};
