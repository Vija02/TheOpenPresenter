import { Avatar, AvatarFallback } from "@repo/ui";

type OrgHeadingProps = {
  name: string;
  className?: string;
};

export const OrgHeading = ({ name, className }: OrgHeadingProps) => (
  <div
    className={
      "flex items-center gap-2 px-1 mb-2" + (className ? " " + className : "")
    }
  >
    <Avatar className="size-6">
      <AvatarFallback>{name?.charAt(0)?.toUpperCase() ?? "?"}</AvatarFallback>
    </Avatar>
    <h2 className="text-xs font-semibold uppercase tracking-wide text-tertiary">
      {name}
    </h2>
  </div>
);
