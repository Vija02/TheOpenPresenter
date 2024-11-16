import PageHeader from "@/components/ui/page-header";
import ViewOnGithub from "@/components/ui/view-on-github";
import { Box, styled } from "@/styled-system/jsx";

export default function Home() {
  return (
    <styled.section>
      <Box pt={{ base: 64, md: 80 }} pb={{ base: 12, md: 20 }}>
        <Box px={{ base: 4, sm: 6 }}>
          <PageHeader
            title="Present everything with a few clicks"
            description="Present your slides, videos, websites, music and more seamlessly"
          >
            Coming Soon
          </PageHeader>

          <Box display="flex" justifyContent="center">
            <styled.a
              mb={4}
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
                px={3}
                py={2}
                fontSize="lg"
              >
                Go to Dashboard
              </styled.span>
            </styled.a>
          </Box>
          <ViewOnGithub />
        </Box>
      </Box>
    </styled.section>
  );
}
