export const getCSRFToken = () => {
  const nextDataEl = document.getElementById("__NEXT_DATA__");
  if (!nextDataEl || !nextDataEl.textContent) {
    throw new Error("Cannot read from __NEXT_DATA__ element");
  }
  const data = JSON.parse(nextDataEl.textContent);

  return data.query.CSRF_TOKEN;
};
