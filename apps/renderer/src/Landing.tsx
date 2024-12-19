import { Box, Heading, Text } from "@chakra-ui/react";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-sans-3";
import { Logo } from "@repo/ui";
import { useMemo } from "react";
import QRCode from "react-qr-code";
import { useParams } from "wouter";

const Landing = () => {
  const params = useParams();

  const { orgSlug, projectSlug } = params;

  const qrcodeUrl = useMemo(
    () => `${window.location.origin}/app/${orgSlug}/${projectSlug}`,
    [orgSlug, projectSlug],
  );

  return (
    <Box
      height="100%"
      bgColor="rgb(10, 10, 10)"
      color="white"
      p={{ base: 10, md: 20 }}
      border="10px solid"
      borderColor="orange.500"
    >
      <Logo height={40} />
      <Box mb={{ base: 6, md: 10, xl: 16 }} />
      <Heading
        color="orange.500"
        textTransform="uppercase"
        fontSize={{ base: "5xl", md: "7xl" }}
        fontWeight="800"
        maxW={{ base: "md", md: "xl" }}
      >
        Nothing to show here yet
      </Heading>
      <Box mb={{ base: 4, md: 7 }} />
      <Text fontSize={{ base: "2xl", md: "3xl" }}>
        This screen loaded perfectly! <br />
        Select something in your device to start presenting.
      </Text>
      <Box mb={7} />
      <Box display="flex" gap={10} alignItems="center">
        <QRCode
          style={{
            height: "auto",
            maxHeight: 256,
            padding: 20,
            background: "white",
          }}
          value={qrcodeUrl}
        />
      </Box>
    </Box>
  );
};
export default Landing;
