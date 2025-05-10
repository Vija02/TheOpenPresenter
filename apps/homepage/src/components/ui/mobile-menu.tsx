import Link from "next/link";

import ThemeToggle from "./theme-toggle";

export default function MobileMenu() {
  return (
    <div className="inline-flex md:hidden">
      {/* Mobile lights switch */}
      <ThemeToggle className="mr-6" />

      <ul className="flex justify-end flex-wrap items-center">
        <li>
          <Link
            href="/login"
            className="btn-sm text-white bg-teal-500 hover:bg-teal-400"
          >
            Login
          </Link>
        </li>
      </ul>
    </div>
  );
}
