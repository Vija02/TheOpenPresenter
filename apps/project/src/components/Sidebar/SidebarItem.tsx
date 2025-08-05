import { Link, useDisclosure } from "@repo/ui";
import React from "react";
import { MdOutlineArrowDropDown } from "react-icons/md";
import { Link as WouterLink, useLocation } from "wouter";

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
  const { open, onToggle } = useDisclosure({
    defaultOpen: location.includes(baseUrl ?? href),
  });

  const isActive = exact
    ? location.split("?")[0] === href
    : location.includes(href);

  return (
    <>
      <div className="stack-row gap-0 flex-1">
        <Link
          asChild
          variant="unstyled"
          className={`flex-1 ${!children && isActive ? "bg-blue-50" : ""}`}
        >
          <WouterLink href={href} className="hover:bg-blue-50">
            <div className="p-3">
              <div className="stack-row gap-4">
                {icon && <div className="text-[24px]">{icon}</div>}
                <span>{name}</span>
              </div>
            </div>
          </WouterLink>
        </Link>
        {children && (
          <div
            className="h-full p-3 hover:bg-blue-50 cursor-pointer"
            onClick={onToggle}
          >
            <div
              data-state={open ? "open" : "closed"}
              className="text-[24px] [&[data-state=open]>svg]:rotate-180"
            >
              <MdOutlineArrowDropDown className="transition-transform" />
            </div>
          </div>
        )}
      </div>
      {children && open && (
        <div className="ml-5 border-l border-gray-300 flex-1">{children}</div>
      )}
    </>
  );
};
