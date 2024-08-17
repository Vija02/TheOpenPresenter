import { useCallback, useState } from "react";
import { ResizableBox, ResizeCallbackData } from "react-resizable";

import { useInitialLoad } from "../../hooks/useInitialLoad";

export const ResizableBoxWrapper = ({
  children,
}: {
  children: React.ReactElement;
}) => {
  const key = useInitialLoad();

  const [sidebarWidth, setSidebarWidth] = useState(200);

  const onResize = useCallback(
    (e: React.SyntheticEvent<Element, Event>, data: ResizeCallbackData) => {
      setSidebarWidth(data.size.width);
    },
    [setSidebarWidth],
  );
  return (
    // @ts-expect-error due to react version mismatch
    <ResizableBox
      key={key}
      className="sidebar-resizable-container"
      width={sidebarWidth}
      height={-1}
      minConstraints={[80, -1]}
      maxConstraints={[600, Infinity]}
      resizeHandles={["e"]}
      onResize={onResize}
    >
      {/* @ts-expect-error due to react version mismatch */}
      {children}
    </ResizableBox>
  );
};
