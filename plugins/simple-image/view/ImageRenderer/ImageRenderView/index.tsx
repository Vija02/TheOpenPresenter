const ImageRenderView = ({ src }: { src: string }) => {
  return (
    <img
      src={src}
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  );
};

export default ImageRenderView;
