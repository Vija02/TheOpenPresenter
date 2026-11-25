import { useSearchParams } from "wouter";

const PARAM = "no_signup";
const STORAGE_KEY = "top:no-signup";

function readStored() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function store() {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore
  }
}

export function useSignupDisabled() {
  const [searchParams] = useSearchParams();
  if (searchParams.get(PARAM) === "1") {
    store();
    return true;
  }
  return readStored();
}

export function withNoSignup(url: string, enabled: boolean) {
  if (!enabled) return url;
  return url + (url.includes("?") ? "&" : "?") + `${PARAM}=1`;
}
