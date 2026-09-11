import { useEffect, useState } from "react";

export type UploadStatus = {
  attemptsRemaining: number | null;
  rejectionMessage: string | null;
  current: {
    originalName: string | null;
    thumbnailMediaNames: string[];
  } | null;
};

export const useUploadStatus = (token: string) => {
  const [status, setStatus] = useState<UploadStatus | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch(`/plugin/slides/upload-status/${token}`);
      if (!res.ok) return;
      setStatus((await res.json()) as UploadStatus);
    } catch {
      // A missing status just means we show nothing extra.
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return { status, refresh };
};
