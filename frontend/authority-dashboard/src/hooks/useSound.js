import { useRef } from "react";

export default function useSound(src) {
  const audioRef = useRef(new Audio(src));

  const play = () => {
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  };

  return play;
}
