"use client";

import AOS from "aos";
import { useEffect } from "react";

export const InitAOS = () => {
  useEffect(() => {
    AOS.init({
      once: true,
      disable: "phone",
      duration: 600,
      easing: "ease-out-sine",
    });
  });
  
  return null;
};
