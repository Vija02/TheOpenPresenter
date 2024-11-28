export const getStaticPath = () =>
  process.env.STATIC_FILES_PATH ||
  "https://raw.githubusercontent.com/Vija02/theopenpresenter-static/refs/heads/main";
