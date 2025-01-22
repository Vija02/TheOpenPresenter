import {
  Flex,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
} from "@chakra-ui/react";

type VolumeBarPropTypes = {
  volume?: number;
  onChange?: (v: number) => void;
};

export const VolumeBar = ({ volume, onChange }: VolumeBarPropTypes) => {
  return (
    <Flex
      flexDirection="column"
      gap={2}
      w="40px"
      px="5px"
      py={4}
      bg="#313131"
      alignItems="center"
    >
      <Text color="white" fontSize="1xs" fontWeight="bold">
        VOL
      </Text>
      <Slider
        id="slider"
        value={volume ?? 1}
        min={0}
        max={1}
        step={0.01}
        orientation="vertical"
        onChange={onChange}
        mb={4}
        mt={10}
        flex={1}
      >
        <SliderTrack
          w={2}
          bg="black"
          border="1px solid rgb(255, 255, 255, 0.3)"
        >
          <SliderFilledTrack bg="rgb(130, 130, 130)" />
        </SliderTrack>
        <SliderThumb
          rounded="5px"
          width="30px"
          height="50px"
          bg="linear-gradient(#282828 0%, #323232 45%, white 45%, white 55%, #383838 55%, #494949 100%)"
          border="1px solid #ffffff1c"
          borderTop="1px solid rgba(255, 255, 255, 0.32)"
          boxShadow="rgba(0, 0, 0, 0.75) 2px 4px 5px 0px"
        />
      </Slider>
    </Flex>
  );
};
