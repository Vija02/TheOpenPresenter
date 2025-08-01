import { Box, Icon, Link, Stack, Text, useDisclosure } from "@chakra-ui/react";
import React from "react";
import { MdOutlineArrowDropDown } from "react-icons/md";
import { Link as WouterLink } from "wouter";
import { useLocation } from "wouter";

type PropTypes = {
  icon?: React.ReactNode;
  name: string;
  baseUrl?: string;
  href: string;
  exact?: boolean;
  children?: React.ReactNode;
};
export const SidebarItem = ({
  icon,
  name,
  baseUrl,
  href,
  exact,
  children,
}: PropTypes) => {
  const [location] = useLocation();

  const { isOpen, onToggle } = useDisclosure({
    defaultIsOpen: location.includes(baseUrl ?? href),
  });

  return (
    <>
      <Stack direction="row" spacing={0} flex={1}>
        <Link
          as={WouterLink}
          href={href}
          color="blue.800"
          textDecor="none"
          flex={1}
          _hover={{ textDecor: "none" }}
          {...(!children &&
          (exact ? location.split("?")[0] === href : location.includes(href))
            ? { bg: "blue.50" }
            : {})}
        >
          <Box p={3} _hover={{ bg: "blue.50" }}>
            <Stack direction="row" spacing={4} alignItems="center">
              {icon && <Icon fontSize="24px">{icon}</Icon>}
              <Text>{name}</Text>
            </Stack>
          </Box>
        </Link>
        {children && (
          <Box
            height="100%"
            p={3}
            _hover={{ bg: "blue.50" }}
            cursor="pointer"
            onClick={onToggle}
          >
            <Icon
              fontSize="24px"
              transform={`rotate(${isOpen ? 180 : 0}deg)`}
              transition="0.1s all ease"
            >
              <MdOutlineArrowDropDown />
            </Icon>
          </Box>
        )}
      </Stack>
      {children && isOpen && (
        <Box ml={5} borderLeft="1px solid" borderColor="gray.300" flex={1}>
          {children}
        </Box>
      )}
    </>
  );
};
