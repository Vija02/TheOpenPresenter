import { Button } from "@chakra-ui/react";
import React from "react";
import { AiFillGithub, AiFillGoogleCircle } from "react-icons/ai";

export interface SocialLoginOptionsProps {
  next: string;
  buttonTextFromService?: (service: string) => string;
}

function defaultButtonTextFromService(service: string) {
  return `Sign in with ${service}`;
}

export function SocialLoginOptions({
  next,
  buttonTextFromService = defaultButtonTextFromService,
}: SocialLoginOptionsProps) {
  return (
    <>
      <a href={`/auth/github?next=${encodeURIComponent(next)}`}>
        <Button size="large">
          <AiFillGithub />
          {buttonTextFromService("GitHub")}
        </Button>
      </a>
      <a href={`/auth/google?next=${encodeURIComponent(next)}`}>
        <Button size="large">
          <AiFillGoogleCircle />
          {buttonTextFromService("Google")}
        </Button>
      </a>
    </>
  );
}
