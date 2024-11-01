// @ts-ignore
const packageJson = require("../../../package.json");

export const fromEmail = '"TheOpenPresenter" <admin@theopenpresenter.com>';
export const supportEmail = "support@theopenpresenter.com";
export const awsRegion = "eu-west-2";
export const projectName = packageJson.projectName.replace(/[-_]/g, " ");
export const companyName = projectName;
export const emailLegalText =
  process.env.LEGAL_TEXT || "<Insert legal email footer text here >";
