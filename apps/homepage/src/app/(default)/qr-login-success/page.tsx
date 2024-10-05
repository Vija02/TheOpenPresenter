import { Box, styled } from "@/styled-system/jsx";

export default function QRLoginSuccess() {
  return (
    <styled.section>
      <Box pt={{ base: 64, md: 80 }} pb={{ base: 12, md: 20 }}>
        <Box px={{ base: 4, sm: 6 }}>
          <styled.h1 textAlign="center" fontSize="3xl" fontWeight="bold">
            Login Successful
          </styled.h1>
          <styled.p textAlign="center" fontSize="xl">
            Your device should now be logged in to the same account.
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
