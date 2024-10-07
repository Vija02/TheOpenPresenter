import React, { FunctionComponent, Suspense } from "react";

import { CssLoading } from "./Loading";

export const withSuspense = (component: FunctionComponent<any>) => {
  return (props: any) => {
    return (
      <Suspense fallback={<CssLoading />}>
        {React.createElement(component, props)}
      </Suspense>
    );
  };
};
