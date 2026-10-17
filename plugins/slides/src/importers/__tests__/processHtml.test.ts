import { describe, expect, it } from "vitest";

import { processHtml } from "../googleSlides/processHtml";

describe("processHtml", () => {
  it("points the viewer's scripts and styles at the proxy cache", () => {
    const html = [
      '<script src="/_/presentations/_/js/k=a/rs=b/m=core"></script>',
      '<link href="/static/presentation/client/css/1-viewer_css_ltr.css">',
      '{"core":["https://docs.google.com/static/presentation/client/js/2-core.js"]}',
      "{'w':'https:\\/\\/docs.google.com\\/static\\/presentation\\/client\\/js\\/3-w.js'}",
    ].join("\n");

    expect(processHtml(html)).toBe(
      [
        '<script src="/proxy-cache/gslide/_/presentations/_/js/k=a/rs=b/m=core"></script>',
        '<link href="/proxy-cache/gslide/static/presentation/client/css/1-viewer_css_ltr.css">',
        '{"core":["/proxy-cache/gslide/static/presentation/client/js/2-core.js"]}',
        "{'w':'\\/proxy-cache\\/gslide\\/static\\/presentation\\/client\\/js\\/3-w.js'}",
      ].join("\n"),
    );
  });

  it("leaves other Google links as they are", () => {
    const html = '<a href="https://docs.google.com/presentation/d/x/edit">';
    expect(processHtml(html)).toBe(html);
  });

  it("leaves the same paths on other hosts alone", () => {
    const html = '<img src="https://ssl.gstatic.com/static/presentation/client/x.png">';
    expect(processHtml(html)).toBe(html);
  });

  it("points Google Fonts at the proxy cache", () => {
    const html =
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto%3A400">' +
      "<style>@font-face{src:url(//fonts.gstatic.com/s/roboto/v48/a.ttf)}</style>" +
      '<script>var c={"f":"https:\\/\\/fonts.googleapis.com\\/css?family=Lato"};</script>';

    expect(processHtml(html)).toBe(
      '<link rel="stylesheet" href="/proxy-cache/gfonts-css/css?family=Roboto%3A400">' +
        "<style>@font-face{src:url(/proxy-cache/gfonts/s/roboto/v48/a.ttf)}</style>" +
        '<script>var c={"f":"\\/proxy-cache\\/gfonts-css\\/css?family=Lato"};</script>',
    );
  });
});
