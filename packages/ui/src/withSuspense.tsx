import React, { FunctionComponent, Suspense } from "react";

import { LoadingPart } from "./Loading";

export const withSuspense = (component: FunctionComponent<any>) => {
  return (props: any) => {
    return (
      <Suspense fallback={<LoadingPart />}>
        {React.createElement(component, props)}
      </Suspense>
    );
  };
};
