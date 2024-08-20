import { styled } from "@/styled-system/jsx";

interface PageHeaderProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export default function PageHeader({
  children,
  title,
  description,
}: PageHeaderProps) {
  return (
    <styled.div maxW="3xl" mx="auto" mb={12}>
      <styled.div textAlign="center">
        <styled.div
          position="relative"
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap={4}
          mb={5}
          _before={{
            content: '""',
            height: "1px",
            width: 24,
            borderBottom: "1px solid",
            borderImage:
              "linear-gradient(to left, token(colors.indigo.300), transparent) 1",
            boxShadow: "sm",
            shadowColor: "white/20",
          }}
          _after={{
            content: '""',
            height: "1px",
            width: 24,
            borderBottom: "1px solid",
            borderImage:
              "linear-gradient(to right, token(colors.indigo.300), transparent) 1",
            boxShadow: "sm",
            shadowColor: "white/20",
          }}
          _dark={{
            _before: {
              borderImage:
                "linear-gradient(to left, token(colors.indigo.300/16), transparent) 1",
              boxShadow: "none",
            },
            _after: {
              borderImage:
                "linear-gradient(to right, token(colors.indigo.300/16), transparent) 1",
              boxShadow: "none",
            },
          }}
        >
          <styled.div
            position="relative"
            fontSize="sm"
            fontWeight="medium"
            color="gray.700"
            bg="white"
            display="inline-flex"
            rounded="lg"
            whiteSpace="nowrap"
            px={3}
            py="3px"
            letterSpacing="normal"
            _before={{
              content: '""',
              position: "absolute",
              inset: 0,
              rounded: "lg",
              bgImage:
                "linear-gradient(120deg, transparent 0%, rgba(99,102,241,0.12) 33%, rgba(244,114,182,0.12) 66%, rgba(253,230,138,0.12) 100%)",
            }}
            _dark={{
              bg: "gray.700",
              _before: {
                bgImage:
                  "linear-gradient(120deg, rgba(99,102,241,0.16), rgba(79,70,229,0.16) 50%, transparent 100%)",
              },
            }}
            shadow="md"
          >
            <styled.span
              position="relative"
              color="gray.800"
              _dark={{
                color: "transparent",
                bgImage:
                  "linear-gradient(to bottom, token(colors.indigo.500), token(colors.indigo.50))",
                bgClip: "text",
              }}
            >
              {children}
            </styled.span>
          </styled.div>
        </styled.div>
        <styled.div>
          <styled.h1
            fontFamily="Inter Tight, sans-serif"
            fontSize={{ base: "5xl", md: "6xl" }}
            fontWeight="bold"
            color="gray.800"
            pb={4}
            _dark={{
              color: "transparent",
              bgImage:
                "linear-gradient(to bottom, token(colors.indigo.200), token(colors.gray.200))",
              bgClip: "text",
            }}
          >
            {title}
          </styled.h1>
          <styled.p
            fontSize="lg"
            color="gray.700"
            _dark={{ color: "gray.400" }}
          >
            {description}
          </styled.p>
        </styled.div>
      </styled.div>
    </styled.div>
  );
}
