import { styled } from "@/styled-system/jsx";

export default function BgShapes() {
  return (
    <styled.div
      position="absolute"
      insetY={0}
      w="1102px"
      left={1 / 2}
      translateX="-50%"
      zIndex={-10}
      pointerEvents="none"
      filter="auto"
      blur="3xl"
      aria-hidden="true"
    >
      <styled.div
        position="absolute"
        w="960px"
        h={24}
        top={12}
        animation="swing 8s ease-in-out infinite"
        _before={{
          position: "absolute",
          content: '""',
          inset: 0,
          roundedTopLeft: "full",
          roundedBottomRight: "full",
          bgGradient: "to-b",
          gradientFrom: "transparent",
          gradientTo: "transparent",
          gradientVia: "indigo.600",
          rotate: "-42deg",
        }}
      />
      <styled.div
        position="absolute"
        w="960px"
        h={24}
        top={-12}
        left={-28}
        animation="swing 15s -1s ease-in-out infinite"
        _before={{
          position: "absolute",
          content: '""',
          inset: 0,
          roundedTopLeft: "full",
          roundedBottomRight: "full",
          bgGradient: "to-b",
          gradientFrom: "transparent",
          gradientTo: "transparent",
          gradientVia: "white",
          rotate: "-42deg",
        }}
        _dark={{ _before: { gradientVia: "indigo.400" } }}
      />
      <styled.div
        position="absolute"
        w="960px"
        h={16}
        top={36}
        left={80}
        animation="swing 7s -2s ease-in-out infinite"
        _before={{
          position: "absolute",
          content: '""',
          inset: 0,
          roundedTopLeft: "full",
          roundedBottomRight: "full",
          bgGradient: "to-b",
          gradientFrom: "transparent",
          gradientTo: "transparent",
          gradientVia: "white",
          rotate: "-42deg",
        }}
        _dark={{ _before: { gradientVia: "indigo.400" } }}
      />
      <styled.div
        position="absolute"
        w="960px"
        h={64}
        top="820px"
        left={44}
        animation="swing 10s ease-in-out infinite"
        _before={{
          position: "absolute",
          content: '""',
          inset: 0,
          roundedTopLeft: "full",
          roundedBottomRight: "full",
          bgGradient: "to-b",
          gradientFrom: "transparent",
          gradientTo: "transparent",
          gradientVia: "indigo.600/30",
          rotate: "-42deg",
        }}
        _dark={{ _before: { gradientVia: "indigo.400/30" } }}
      />
      <styled.div
        position="absolute"
        w="480px"
        h={12}
        top="970px"
        left="550px"
        animation="swing 15s -2s ease-in-out infinite"
        _before={{
          position: "absolute",
          content: '""',
          inset: 0,
          roundedTopLeft: "full",
          roundedBottomRight: "full",
          bgGradient: "to-b",
          gradientFrom: "transparent",
          gradientTo: "transparent",
          gradientVia: "white",
          rotate: "-42deg",
        }}
        _dark={{ _before: { gradientVia: "indigo.950" } }}
      />
      <styled.div
        position="absolute"
        w="960px"
        h={16}
        top="820px"
        left={24}
        animation="swing 9s -3s ease-in-out infinite"
        _before={{
          position: "absolute",
          content: '""',
          inset: 0,
          roundedTopLeft: "full",
          roundedBottomRight: "full",
          bgGradient: "to-b",
          gradientFrom: "transparent",
          gradientTo: "transparent",
          gradientVia: "white",
          rotate: "-42deg",
        }}
        _dark={{ _before: { gradientVia: "indigo.900" } }}
      />
    </styled.div>
  );
}
