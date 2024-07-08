import PageHeader from "@/components/page-header";
import ViewOnGithub from "@/components/view-on-github";
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

          <ViewOnGithub />
        </Box>
      </Box>
    </styled.section>
  );
}
