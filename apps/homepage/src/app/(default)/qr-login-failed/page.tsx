import { Box, styled } from "@/styled-system/jsx";

export default function QRLoginFailed() {
  return (
    <styled.section>
      <Box pt={{ base: 64, md: 80 }} pb={{ base: 12, md: 20 }}>
        <Box px={{ base: 4, sm: 6 }}>
          <styled.h1 textAlign="center" fontSize="3xl" fontWeight="bold">
            Login not successful
          </styled.h1>
          <styled.p textAlign="center" fontSize="xl">
            Something went wrong when trying to log into your account. Please
            try again
          </styled.p>

          <Box display="flex" justifyContent="center">
            <styled.a
              mt={6}
              href="/o"
              bg="indigo.700"
              color="white"
              padding="5px 10px"
              borderRadius="md"
              fontWeight="bold"
              transition="background-color 0.3s"
              _hover={{ bg: "indigo.800" }}
            >
              <styled.span
                display="flex"
                flex={1}
                alignItems="center"
                gap={3}
                fontSize="lg"
              >
                Go to Dashboard
              </styled.span>
            </styled.a>
          </Box>
        </Box>
      </Box>
    </styled.section>
  );
}
