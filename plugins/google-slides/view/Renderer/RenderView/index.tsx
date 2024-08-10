const RenderView = ({ src, slideId }: { src: string; slideId: string }) => {
  const url = new URL(src);

  const basePathName = url.pathname.split("/").slice(0, -1).join("/");
  const embedLink =
    url.origin + basePathName + "/embed?rm=minimal" + "#slide=id." + slideId;

  return (
    <iframe
      style={{ border: 0, width: "100%", height: "100%" }}
      src={embedLink}
    />
  );
};

export default RenderView;
