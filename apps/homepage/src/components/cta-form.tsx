"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CTAForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  return (
    <form
      className="mt-8"
      data-aos="fade-down"
      data-aos-delay="300"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/register?email=${email}`);
      }}
    >
      <div className="flex flex-col sm:flex-row justify-center max-w-sm mx-auto sm:max-w-md md:mx-0">
        <input
          type="text"
          className="form-input w-full mb-2 sm:mb-0 sm:mr-2"
          placeholder="E-mail address"
          aria-label="E-mail address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <a
          className="btn text-white bg-teal-500 hover:bg-teal-400 shrink-0"
          href={`/register?email=${email}`}
        >
          Try now
        </a>
      </div>
    </form>
  );
}
