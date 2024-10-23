import { fromEmail } from "@repo/config";
import { Task } from "graphile-worker";
import { htmlToText } from "html-to-text";
import * as nodemailer from "nodemailer";

import {
  readTemplateFile,
  replaceTemplateVariablesAndConvertHtml,
} from "../email";
import getTransport from "../transport";

declare module global {
  let TEST_EMAILS: any[];
}

global.TEST_EMAILS = [];

const isTest = process.env.NODE_ENV === "test";
const isDev = process.env.NODE_ENV !== "production";

export interface SendEmailPayload {
  options: {
    from?: string;
    to: string | string[];
    subject: string;
  };
  template?: string;
  html?: string;
  variables?: {
    [varName: string]: any;
  };
}

const task: Task = async (inPayload) => {
  const { default: chalk } = await import("chalk");
  
  const payload: SendEmailPayload = inPayload as any;
  const transport = await getTransport();
  const { options: inOptions, template, html, variables } = payload;
  const options = {
    from: fromEmail,
    ...inOptions,
  };

  let finalHtml = html;
  if (!finalHtml && !!template) {
    const templateFn = await loadTemplate(template);
    finalHtml = await templateFn(variables);
  }

  if (finalHtml) {
    const html2textableHtml = finalHtml.replace(/(<\/?)div/g, "$1p");
    const text = htmlToText(html2textableHtml, {
      wordwrap: 120,
    }).replace(/\n\s+\n/g, "\n\n");
    Object.assign(options, { html: finalHtml, text });
  }

  const info = await transport.sendMail(options);
  if (isTest) {
    global.TEST_EMAILS.push(info);
  } else if (isDev) {
    const url = nodemailer.getTestMessageUrl(info);
    if (url) {
      console.log(`Development email preview: ${chalk.blue.underline(url)}`);
    }
  }
};

export default task;

const templatePromises: Record<any, any> = {};
function loadTemplate(template: string) {
  if (isDev || !templatePromises[template]) {
    templatePromises[template] = (async () => {
      const templateString = await readTemplateFile(template);

      return replaceTemplateVariablesAndConvertHtml(templateString);
    })();
  }
  return templatePromises[template];
}
