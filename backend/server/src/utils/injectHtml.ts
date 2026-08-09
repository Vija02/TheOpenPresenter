// Code adapted from
// https://github.com/vitejs/vite/blob/3b8f03d789ec3ef1a099c884759bd4e61b03ce7c/packages/vite/src/node/plugins/html.ts#L1379

const headInjectRE = /([ \t]*)<\/head>/i;

export const injectEndOfHead = (html: string, stringToInject: string) => {
  if (headInjectRE.test(html)) {
    return html.replace(headInjectRE, (match) => {
      return `${stringToInject}\n${match}`;
    });
  }

  return html;
};

const headStartInjectRE = /(<head[^>]*>)/i;

export const injectStartOfHead = (html: string, stringToInject: string) => {
  if (headStartInjectRE.test(html)) {
    return html.replace(headStartInjectRE, (match) => {
      return `${match}\n${stringToInject}`;
    });
  }

  return html;
};
