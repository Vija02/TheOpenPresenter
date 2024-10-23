import { emailLegalText as legalText, projectName } from "@repo/config";
import { promises as fsp } from "fs";
import { template as lodashTemplate } from "lodash";
// @ts-ignore
import mjml2html = require("mjml");

declare module global {
  let TEST_EMAILS: any[];
}

global.TEST_EMAILS = [];

const { readFile } = fsp;

export const readTemplateFile = async (template: string) => {
  if (!template.match(/^[a-zA-Z0-9_.-]+$/)) {
    throw new Error(`Disallowed template name '${template}'`);
  }
  const templateString = (
    await readFile(`${__dirname}/../templates/${template}`, "utf8")
  ).replace(/\.\/common\//g, `${__dirname}/../templates/common/`);

  return templateString;
};

export const replaceTemplateVariablesAndConvertHtml =
  (templateString: string) => (variables: { [varName: string]: any }) => {
    const { html, errors } = mjml2html(templateString);
    if (errors && errors.length) {
      console.error(errors);
    }

    const templateFn = lodashTemplate(html, {
      escape: /\[\[([\s\S]+?)\]\]/g,
    });
    const htmlWithVars = templateFn({
      projectName,
      legalText,
      ...variables,
    });
    return htmlWithVars;
  };
