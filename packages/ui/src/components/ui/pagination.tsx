import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";
import { useMemo } from "react";
import ReactPaginate from "react-paginate";

import "./pagination.css";

type ReactPaginateWrapperProps = {
  pageCount: number;
  pageRangeDisplayed?: number;
  marginPagesDisplayed?: number;
  previousLabel?: React.ReactNode;
  nextLabel?: React.ReactNode;
  breakLabel?: React.ReactNode;
  onPageChange: (selectedItem: { selected: number }) => void;
  forcePage?: number;
  initialPage?: number;
  disableInitialCallback?: boolean;
  className?: string;
  renderOnZeroPageCount?: (() => React.ReactNode) | null;
};

function Pagination({
  pageCount,
  pageRangeDisplayed = 3,
  marginPagesDisplayed = 1,
  previousLabel,
  nextLabel,
  breakLabel = "...",
  onPageChange,
  forcePage,
  initialPage,
  disableInitialCallback = false,
  className,
  renderOnZeroPageCount,
  ...props
}: ReactPaginateWrapperProps) {
  const defaultPreviousLabel = useMemo(
    () => (
      <>
        <ChevronLeftIcon className="size-4" />
        <span className="ui--pagination-navigation-text">Previous</span>
      </>
    ),
    [],
  );

  const defaultNextLabel = useMemo(
    () => (
      <>
        <span className="ui--pagination-navigation-text">Next</span>
        <ChevronRightIcon className="size-4" />
      </>
    ),
    [],
  );

  return (
    <ReactPaginate
      pageCount={pageCount}
      pageRangeDisplayed={pageRangeDisplayed}
      marginPagesDisplayed={marginPagesDisplayed}
      previousLabel={previousLabel ?? defaultPreviousLabel}
      nextLabel={nextLabel ?? defaultNextLabel}
      breakLabel={breakLabel}
      onPageChange={onPageChange}
      forcePage={forcePage}
      initialPage={initialPage}
      disableInitialCallback={disableInitialCallback}
      renderOnZeroPageCount={renderOnZeroPageCount}
      // Container
      className={className}
      containerClassName="ui--pagination"
      // Main
      pageLinkClassName="ui--pagination-link ui--pagination-link__icon"
      // Navigation
      previousLinkClassName="ui--pagination-link ui--pagination-nav-link"
      nextLinkClassName="ui--pagination-link ui--pagination-nav-link"
      // Disabled
      disabledClassName="opacity-50 pointer-events-none"
      disabledLinkClassName="opacity-50 pointer-events-none"
      // Break
      breakLinkClassName="ui--pagination-link"
      {...props}
    />
  );
}

export { Pagination };
