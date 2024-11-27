import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { proxy } from "valtio";

type AudioCheckProviderType = {
  canPlayAudio: {
    value: boolean;
  };
};

const initialData: AudioCheckProviderType = {
  canPlayAudio: { value: false },
};

export const AudioCheckContext =
  createContext<AudioCheckProviderType>(initialData);

export function AudioCheckProvider({ children }: React.PropsWithChildren<{}>) {
  const [canPlayObj, setCanPlayObj] = useState({
    value: false,
    isChecking: false,
  });
  const subscriber = useRef<Record<string, () => void>>({});
  const audioRef = useRef<HTMLAudioElement>(null);

  const audioCanPlay = proxy({
    get value() {
      if (canPlayObj.value) {
        return true;
      }
      if (!canPlayObj.isChecking) {
        setCanPlayObj({ value: false, isChecking: true });
      }

      return false;
    },
    get subscribe() {
      return (callback: () => void) => {
        const id = performance.now().toString();
        subscriber.current[id] = callback;
        return () => {
          delete subscriber.current[id];
        };
      };
    },
  });

  useEffect(() => {
    if (canPlayObj.value) return;
    if (canPlayObj.isChecking) {
      const interval = setInterval(async () => {
        try {
          await audioRef.current?.play();
          setCanPlayObj({ value: true, isChecking: false });
          Object.values(subscriber.current).forEach((callback) => {
            callback();
          });

          clearInterval(interval);
        } catch (e) {
          console.log("Checking autoplay. Error:", e);
        }
      }, 1000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [canPlayObj.isChecking, canPlayObj.value]);

  return (
    <AudioCheckContext.Provider
      value={{
        canPlayAudio: audioCanPlay,
      }}
    >
      <audio style={{ display: "none" }} ref={audioRef} src={objectUrl} />
      {children}
    </AudioCheckContext.Provider>
  );
}

export function useAudioCheck() {
  return useContext(AudioCheckContext);
}

const objectUrl = URL.createObjectURL(
  new Blob(
    [
      new Uint8Array([
        255, 227, 24, 196, 0, 0, 0, 3, 72, 1, 64, 0, 0, 4, 132, 16, 31, 227,
        192, 225, 76, 255, 67, 12, 255, 221, 27, 255, 228, 97, 73, 63, 255, 195,
        131, 69, 192, 232, 223, 255, 255, 207, 102, 239, 255, 255, 255, 101,
        158, 206, 70, 20, 59, 255, 254, 95, 70, 149, 66, 4, 16, 128, 0, 2, 2,
        32, 240, 138, 255, 36, 106, 183, 255, 227, 24, 196, 59, 11, 34, 62, 80,
        49, 135, 40, 0, 253, 29, 191, 209, 200, 141, 71, 7, 255, 252, 152, 74,
        15, 130, 33, 185, 6, 63, 255, 252, 195, 70, 203, 86, 53, 15, 255, 255,
        247, 103, 76, 121, 64, 32, 47, 255, 34, 227, 194, 209, 138, 76, 65, 77,
        69, 51, 46, 57, 55, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170,
        255, 227, 24, 196, 73, 13, 153, 210, 100, 81, 135, 56, 0, 170, 170, 170,
        170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170,
        170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170,
        170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170,
        170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170,
      ]),
    ],
    { type: "audio/mpeg" },
  ),
);
