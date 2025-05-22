import React, { FunctionComponent, Suspense } from "react";

import { LoadingFull } from "./Loading";

export const withSuspense = (component: FunctionComponent<any>) => {
  return (props: any) => {
    return (
      <Suspense fallback={<LoadingFull />}>
        {React.createElement(component, props)}
      </Suspense>
    );
  };
};
