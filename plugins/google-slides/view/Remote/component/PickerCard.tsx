import { Box, Text, chakra } from "@chakra-ui/react";
import { VscLoading as VscLoadingRaw } from "react-icons/vsc";

const VscLoading = chakra(VscLoadingRaw);

export const PickerCard = ({
  icon,
  text,
  onClick,
  isLoading,
}: {
  icon: React.ReactNode;
  text: string;
  onClick: () => void;
  isLoading?: boolean;
}) => {
  return (
    <Box
      border="1px solid"
      borderColor="gray.200"
      rounded="sm"
      p={2}
      width="100%"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      aspectRatio={1}
      gap={3}
      {...(isLoading
        ? { cursor: "not-allowed", opacity: 0.8 }
        : {
            _hover: { borderColor: "blue.400" },
            onClick,
            cursor: "pointer",
          })}
    >
      {icon}
      <Text fontWeight="bold" fontSize="md">
        {text}
      </Text>
      {isLoading && (
        <VscLoading fontSize="3xl" animation="spin 1s infinite linear" />
      )}
    </Box>
  );
};
