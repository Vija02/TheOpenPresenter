import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { getServerSidePropsDeviceType, withDeviceType } from "@/lib/DeviceType";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Link,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  MediaFragment,
  useCompleteMediaMutation,
  useDeleteMediaMutation,
  useOrganizationMediaIndexPageQuery,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import { PopConfirm } from "@repo/ui";
import { NextPage } from "next";
import prettyBytes from "pretty-bytes";
import { useCallback, useMemo } from "react";
import { VscCheck, VscLinkExternal, VscTrash } from "react-icons/vsc";
import { toast } from "react-toastify";

const OrganizationMediaPage: NextPage = () => {
  const slug = useOrganizationSlug();
  const query = useOrganizationMediaIndexPageQuery({ variables: { slug } });

  const emptyMedia = useMemo(
    () => query.data?.organizationBySlug?.medias.nodes.length === 0,
    [query.data?.organizationBySlug?.medias.nodes.length],
  );

  return (
    <SharedOrgLayout title="Dashboard" sharedOrgQuery={query}>
      <Flex px={1} alignItems="center" justifyContent="space-between" mb={3}>
        <Heading mb={0}>Media</Heading>
      </Flex>

      {emptyMedia && (
        <VStack
          alignItems="center"
          marginBottom={2}
          flexWrap="wrap"
          spacing={0}
        >
          <EmptyMedia />
        </VStack>
      )}
      <Grid
        gridTemplateColumns="repeat(auto-fill, minmax(200px, 1fr) )"
        gap={2}
        w="100%"
      >
        {query.data?.organizationBySlug?.medias.nodes.map((media) => (
          <MediaCard key={media.id} media={media} />
        ))}
      </Grid>
    </SharedOrgLayout>
  );
};

const EmptyMedia = () => {
  return (
    <Box mt={3} w="100%">
      <Text fontSize="lg" fontWeight="bold">
        Welcome to your Media page!
      </Text>
      <Text>There's currently nothing here.</Text>
    </Box>
  );
};

const MediaCard = ({ media }: { media: MediaFragment }) => {
  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });
  const [deleteMedia] = useDeleteMediaMutation({
    onCompleted: publish,
  });
  const [completeMedia, { loading: completeIsLoading }] =
    useCompleteMediaMutation({
      onCompleted: publish,
    });

  const handleDeleteMedia = useCallback(
    async (id: string) => {
      try {
        await deleteMedia({
          variables: {
            id,
          },
        });
        toast.success("Media successfully deleted");
      } catch (e: any) {
        toast.error("Error occurred when deleting this media: " + e.message);
      }
    },
    [deleteMedia],
  );
  const handleCompleteMedia = useCallback(
    async (id: string) => {
      try {
        await completeMedia({
          variables: {
            id,
          },
        });
        toast.success("Media successfully completed");
      } catch (e: any) {
        toast.error("Error occurred when deleting this media: " + e.message);
      }
    },
    [completeMedia],
  );

  const fileSize = useMemo(() => {
    const parsed = parseInt(media.fileSize, 10);
    if (Number.isSafeInteger(parsed)) {
      return prettyBytes(parsed);
    }

    return "Unknown";
  }, [media.fileSize]);

  return (
    <Flex
      flexDir="column"
      border="1px solid"
      borderColor="gray.400"
      p={1}
      justifyContent="space-between"
      gap={2}
    >
      <Flex flexDir="column">
        <Text fontWeight="bold">Media Name</Text>
        <Text>{media.mediaName}</Text>
        <Text fontWeight="bold">Original Name</Text>
        <Text>{media.originalName === "" ? "-" : media.originalName}</Text>
        <Text fontWeight="bold">File Size</Text>
        <Text>{fileSize}</Text>
        <Text fontWeight="bold">Is Complete</Text>
        <Text>{media.isComplete ? "YES" : "NO"}</Text>
      </Flex>

      <Stack
        key={JSON.stringify(media)}
        direction="row"
        justifyContent="center"
      >
        {!media.isComplete && (
          <Button
            variant="ghost"
            size="sm"
            role="button"
            color="gray"
            _hover={{ bg: "green.50", color: "green.400" }}
            isLoading={completeIsLoading}
            onClick={() => handleCompleteMedia(media.id)}
          >
            <VscCheck />
          </Button>
        )}

        <Link href={`/media/data/${media.mediaName}`} isExternal>
          <Button variant="ghost" size="sm" role="button" color="gray">
            <VscLinkExternal />
          </Button>
        </Link>

        <PopConfirm
          title={`Are you sure you want to delete this media? This action is not reversible.`}
          onConfirm={() => handleDeleteMedia(media.id)}
          okText="Yes"
          cancelText="No"
          key="remove"
        >
          <Button
            variant="ghost"
            size="sm"
            role="button"
            color="gray"
            _hover={{ bg: "red.50", color: "red.400" }}
          >
            <VscTrash />
          </Button>
        </PopConfirm>
      </Stack>
    </Flex>
  );
};

export const getServerSideProps = getServerSidePropsDeviceType;

export default withDeviceType(OrganizationMediaPage);
