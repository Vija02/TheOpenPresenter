import { SharedLayout } from "@/components/SharedLayout";
import { zodResolver } from "@hookform/resolvers/zod";
import { ScreenByCodeDocument, useSharedQuery } from "@repo/graphql";
import {
  Alert,
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@repo/ui";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { useClient } from "urql";
import z from "zod";

const OTP_PATTERN = "^[2-9a-hjkmnp-zA-HJKMNP-Z]*$";

// Crockford-style alphabet matching BE
const CODE_REGEX = /^[2-9A-HJKMNP-Z]{4}$/;

const formSchema = z.object({
  screenCode: z
    .string()
    .transform((s) => s.trim().toUpperCase())
    .refine((s) => CODE_REGEX.test(s), "Enter the 4-character code"),
});
type FormInputs = z.infer<typeof formSchema>;

export default function ConnectPage() {
  const query = useSharedQuery();
  return (
    <SharedLayout title="Connect" query={query}>
      <div className="flex justify-center mt-16 px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-1">Connect to a screen</h1>
          <p className="text-secondary text-sm mb-6">
            Enter the 4-character code shown on the screen to open its controls.
          </p>
          <ConnectForm />
        </div>
      </div>
    </SharedLayout>
  );
}

function ConnectForm() {
  const client = useClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { screenCode: "" },
  });

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      setServerError(null);
      try {
        const result = await client
          .query(
            ScreenByCodeDocument,
            { code: values.screenCode },
            { requestPolicy: "network-only" },
          )
          .toPromise();

        if (result.error) {
          setServerError(result.error.message);
          return;
        }

        const found = result.data?.screenByCode;
        if (!found?.organizationSlug || !found?.screenSlug) {
          form.setError("screenCode", {
            type: "manual",
            message: "No screen found with that code",
          });
          return;
        }

        window.location.href = `/o/${found.organizationSlug}/screens/${found.screenSlug}/control`;
      } catch (e: any) {
        setServerError(e?.message ?? "Something went wrong");
      }
    },
    [client, form],
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="stack-col items-start gap-4">
          <FormField
            control={form.control}
            name="screenCode"
            render={({ field }) => (
              <FormItem className="w-full justify-items-center">
                <FormLabel>Screen code</FormLabel>
                <FormControl>
                  <InputOTP
                    maxLength={4}
                    pattern={OTP_PATTERN}
                    inputMode="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                    data-testid="connectpage-input-code"
                    data-form-type="other"
                    data-1p-ignore
                    data-lpignore="true"
                    data-bwignore
                    containerClassName="justify-center gap-3"
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v.toUpperCase())}
                    onComplete={() => form.handleSubmit(onSubmit)()}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  >
                    <InputOTPGroup className="gap-3">
                      <InputOTPSlot
                        index={0}
                        className="h-14 w-14 rounded-sm border-l text-2xl font-mono uppercase"
                      />
                      <InputOTPSlot
                        index={1}
                        className="h-14 w-14 rounded-sm border-l text-2xl font-mono uppercase"
                      />
                      <InputOTPSlot
                        index={2}
                        className="h-14 w-14 rounded-sm border-l text-2xl font-mono uppercase"
                      />
                      <InputOTPSlot
                        index={3}
                        className="h-14 w-14 rounded-sm border-l text-2xl font-mono uppercase"
                      />
                    </InputOTPGroup>
                  </InputOTP>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {serverError ? (
            <Alert variant="destructive" title="Could not connect">
              {serverError}
            </Alert>
          ) : null}

          <Button
            type="submit"
            variant="success"
            isLoading={form.formState.isSubmitting}
            className="w-full"
          >
            Connect
          </Button>
        </div>
      </form>
    </Form>
  );
}
