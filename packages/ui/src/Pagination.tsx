import {
  PaginationContainer,
  PaginationNext,
  PaginationPage,
  PaginationPageGroup,
  PaginationPrevious,
  PaginationSeparator,
  Pagination as Paginator,
} from "@ajna/pagination";
import { Box } from "@chakra-ui/react";
import useComponentSize from "@rehooks/component-size";
import { useMemo, useRef } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

export interface PaginationProps {
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange?: (page: number) => void;
}

const getSequenceStartingFrom = (startSeq = 1, count = 1) => {
  return Array.from(Array(count).keys()).map((x) => x + startSeq);
};

export function Pagination({
  currentPage,
  pageSize,
  total,
  onPageChange: handlePaginationChange = () => {},
}: PaginationProps) {
  const ref = useRef(null);
  const { width } = useComponentSize(ref);

  const pageCount = Math.ceil(total / pageSize);
  const [numOfStartAndEnd, numOfSurround] = useMemo(() => {
    if (width > 500) {
      return [2, 2];
    }

    if (width > 440) {
      return [1, 1];
    }

    if (width > 400) {
      return [1, 0];
    }

    return [0, 0];
  }, [width]);

  const pages = useMemo(() => {
    const arrWithStartAndEnd = ([] as number[])
      .concat(getSequenceStartingFrom(1, numOfStartAndEnd))
      .concat(
        getSequenceStartingFrom(
          pageCount - numOfStartAndEnd + 1,
          numOfStartAndEnd,
        ),
      );

    const arrWithAllVal = arrWithStartAndEnd.concat(
      getSequenceStartingFrom(
        currentPage - numOfSurround,
        numOfSurround * 2 + 1,
      ),
    );

    const sortedArr = Array.from(
      new Set(arrWithAllVal.filter((x) => x >= 1 && x <= pageCount)),
    ).sort();

    // This is a const from the @ajna/pagination library
    // https://github.com/niconiahi/ajna/blob/main/packages/pagination/src/lib/constants.ts
    const leftSeparator = 0;
    const rightSeparator = -1;

    return splitSequence(sortedArr).reduce((acc, val, i) => {
      if (i === 1) {
        return [...acc, leftSeparator, ...val];
      } else if (i === 2) {
        return [...acc, rightSeparator, ...val];
      } else {
        return val;
      }
    }, []);
  }, [currentPage, numOfStartAndEnd, numOfSurround, pageCount]);

  if (pageCount === 1) {
    return null;
  }

  return (
    <Box ref={ref} maxWidth="lg" width="100%">
      <Paginator
        pagesCount={Math.ceil(total / pageSize)}
        currentPage={currentPage}
        onPageChange={handlePaginationChange}
      >
        <PaginationContainer
          align="center"
          justify="space-between"
          w="full"
          p={4}
        >
          <PaginationPrevious
            variant="ghost"
            size="sm"
            minW={24}
            mr={2}
            color="blue.500"
            alignItems="center"
          >
            <FiChevronLeft size={16} />
            Previous
          </PaginationPrevious>
          <PaginationPageGroup
            isInline
            align="center"
            separator={
              <PaginationSeparator
                isDisabled
                fontSize="sm"
                w={7}
                jumpSize={11}
              />
            }
          >
            {pages.length > 1 &&
              pages.map((page: number) => (
                <PaginationPage
                  key={`page_${page}`}
                  page={page}
                  w={7}
                  size="sm"
                  variant="ghost"
                  px={2}
                  width="32px"
                  fontSize="sm"
                  _hover={{
                    border: "1px solid",
                    borderColor: "gray.300",
                  }}
                  _current={{
                    bg: "green.500",
                    color: "white",
                  }}
                />
              ))}
          </PaginationPageGroup>
          <PaginationNext
            variant="ghost"
            size="sm"
            minW={24}
            ml={2}
            color="blue.500"
            alignItems="center"
          >
            Next
            <FiChevronRight size={16} />
          </PaginationNext>
        </PaginationContainer>
      </Paginator>
    </Box>
  );
}

// https://stackoverflow.com/a/45879627/3101690
const splitSequence = (input: number[]) => {
  return input.reduce(
    (memo, item) => {
      const lastArray = memo[memo.length - 1];
      const lastItem = lastArray[lastArray.length - 1];

      if (!lastItem || item - lastItem === 1) {
        lastArray.push(item);
      } else {
        memo.push([item]);
      }

      return memo;
    },
    [[]] as number[][],
  );
};
