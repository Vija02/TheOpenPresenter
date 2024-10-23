// @ts-ignore
const packageJson = require("../../../package.json");

// TODO: customise this with your own settings!

export const fromEmail =
  '"TheOpenPresenter" <admin@theopenpresenter.com>';
export const awsRegion = "eu-west-2";
export const projectName = packageJson.projectName.replace(/[-_]/g, " ");
export const companyName = projectName; // For copyright ownership
export const emailLegalText =
  // Envvar here so we can override on the demo website
  process.env.LEGAL_TEXT || "<Insert legal email footer text here >";
