import { companyName } from "@repo/config";
import { Link, Logo } from "@repo/ui";
import { Link as WouterLink } from "wouter";

import { StandardWidth } from "./StandardWidth";

// TODO: All these pages
export function Footer() {
  return (
    <div className="p-4 bg-gray-900">
      <StandardWidth>
        <div className="flex justify-between w-full flex-col md:flex-row gap-10">
          <div className="stack-col items-start gap-0 text-white">
            <Logo height={40} />
            <div className="pb-5" />
            <p className="text-white">
              &copy; {new Date().getFullYear()} {companyName}
            </p>
            <Link asChild className="font-bold text-white">
              <WouterLink href="/support">Support</WouterLink>
            </Link>
            <Link asChild className="font-bold text-white">
              <WouterLink href="/privacy">Privacy Policy</WouterLink>
            </Link>
          </div>
          <div className="stack-row gap-14 items-start">
            <div className="flex flex-col items-start">
              <p className="text-right text-lg text-white mb-4 font-bold">
                CONTACT
              </p>
              <div className="stack-col items-start gap-1">
                <Link asChild className="text-base font-medium text-white">
                  <WouterLink href="mailto:support@theopenpresenter.com">
                    Email
                  </WouterLink>
                </Link>
                <Link asChild className="text-base font-medium text-white">
                  <WouterLink href="/support">Support</WouterLink>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </StandardWidth>
    </div>
  );
}
