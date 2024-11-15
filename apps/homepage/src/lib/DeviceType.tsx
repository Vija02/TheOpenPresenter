import { createContext, use } from "react";

export const getServerSidePropsDeviceType = (context: any) => {
  const userAgent = context.req.headers["user-agent"];
  const deviceType = /mobile/i.test(userAgent) ? "mobile" : "desktop";

  return {
    props: {
      deviceType,
    },
  };
};

export const DeviceTypeContext = createContext<{
  deviceType: "desktop" | "mobile";
}>({
  deviceType: "desktop",
});

export function useDeviceType() {
  return use(DeviceTypeContext).deviceType;
}

export const withDeviceType = (WrappedComponent: any) => (props: any) => {
  return (
    <DeviceTypeContext.Provider
      value={{ deviceType: props.deviceType ?? "desktop" }}
    >
      <WrappedComponent />
    </DeviceTypeContext.Provider>
  );
};
