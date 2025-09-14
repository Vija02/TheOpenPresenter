import { Redirect } from "@/components/Redirect";
import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  EmailsForm_UserEmailFragment,
  useAddEmailMutation,
  useDeleteEmailMutation,
  useMakeEmailPrimaryMutation,
  useResendEmailVerificationMutation,
  useSettingsEmailsPageQuery,
} from "@repo/graphql";
import { extractError } from "@repo/lib";
import {
  Alert,
  Button,
  ErrorAlert,
  Form,
  InputControl,
  LoadingFull,
  PopConfirm,
} from "@repo/ui";
import React from "react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { CombinedError } from "urql";
import { z } from "zod";

function Email({
  email,
  hasOtherEmails,
}: {
  email: EmailsForm_UserEmailFragment;
  hasOtherEmails: boolean;
}) {
  const canDelete = !email.isPrimary && hasOtherEmails;
  const [, deleteEmail] = useDeleteEmailMutation();
  const [, resendEmailVerification] = useResendEmailVerificationMutation();
  const [, makeEmailPrimary] = useMakeEmailPrimaryMutation();

  const actions = [
    email.isPrimary && (
      <span
        data-cy="settingsemails-indicator-primary"
        className="text-orange-500 font-bold"
      >
        Primary
      </span>
    ),
    canDelete && (
      <PopConfirm
        title={`Are you sure you want to remove this email?`}
        onConfirm={async () => {
          await deleteEmail({
            emailId: email.id,
          });
          toast.success("Email deleted!");
        }}
        okText="Yes"
        cancelText="No"
        key="remove"
      >
        <Button size="sm" variant="link" data-cy="settingsemails-button-delete">
          Delete
        </Button>
      </PopConfirm>
    ),
    !email.isVerified && (
      <Button
        size="sm"
        variant="link"
        onClick={async () => {
          await resendEmailVerification({
            emailId: email.id,
          });
          toast.success("Verification email has been sent!");
        }}
      >
        Resend verification
      </Button>
    ),
    email.isVerified && !email.isPrimary && (
      <Button
        size="sm"
        variant="link"
        onClick={() => makeEmailPrimary({ emailId: email.id })}
        data-cy="settingsemails-button-makeprimary"
      >
        Make primary
      </Button>
    ),
  ].filter((x) => !!x);

  return (
    <tr
      data-cy={`settingsemails-emailitem-${email.email.replace(
        /[^a-zA-Z0-9]/g,
        "-",
      )}`}
      key={email.id}
    >
      <td className="border p-3 border-r-0">
        <div>
          <div>
            <span>
              {email.email}{" "}
              <span
                title={
                  email.isVerified
                    ? "Verified"
                    : "Pending verification (please check your inbox / spam folder)"
                }
              >
                {email.isVerified ? (
                  "✅"
                ) : (
                  <small className="text-red-500">(unverified)</small>
                )}
              </span>
            </span>
          </div>
          <div className="text-tertiary text-sm">
            Added {new Date(Date.parse(email.createdAt)).toLocaleString()}
          </div>
        </div>
      </td>
      <td className="border p-3 border-l-0">
        <div className="stack-row items-center justify-end whitespace-nowrap">
          {actions.map((action, i) => (
            <React.Fragment key={i}>
              {action}
              {i !== actions.length - 1 && (
                <div className="w-px h-5 bg-gray-300" />
              )}
            </React.Fragment>
          ))}
        </div>
      </td>
    </tr>
  );
}

const Settings_Emails = () => {
  const [showAddEmailForm, setShowAddEmailForm] = useState(false);
  const [formError, setFormError] = useState<Error | CombinedError | null>(
    null,
  );
  const query = useSettingsEmailsPageQuery();
  const { data, fetching: loading, error } = query[0];
  const user = data && data.currentUser;

  return (
    <SharedLayoutLoggedIn title="Email Settings" query={query} noHandleErrors>
      {error && !loading ? (
        <ErrorAlert error={error} />
      ) : !user && !loading ? (
        <Redirect
          href={`/login?next=${encodeURIComponent("/settings/emails")}`}
        />
      ) : !user ? (
        <LoadingFull />
      ) : (
        <div>
          <h1 className="text-2xl font-bold mb-4">Email Addresses</h1>
          {user.isVerified ? null : (
            <div className="mb-2">
              <Alert variant="warning" title="No verified emails">
                You do not have any verified email addresses, this will make
                account recovery impossible and may limit your available
                functionality within this application. Please complete email
                verification.
              </Alert>
            </div>
          )}
          <p className="mb-5">
            <b>Account notices will be sent your primary email address.</b>{" "}
            Additional email addresses may be added to help with account
            recovery (or to change your primary email), but they cannot be used
            until verified.
          </p>

          <table className="w-full border mb-5">
            <thead>
              <tr className="bg-surface-secondary">
                <th className="text-secondary p-3 text-left">Email address</th>
                <th className="p-3 text-left w-32"></th>
              </tr>
            </thead>
            <tbody>
              {user.userEmails.nodes.map((email, i) => (
                <Email
                  key={i}
                  email={email}
                  hasOtherEmails={user.userEmails.nodes.length > 1}
                />
              ))}
            </tbody>
          </table>

          {!showAddEmailForm ? (
            <Button
              variant="success"
              size="sm"
              onClick={() => setShowAddEmailForm(true)}
              data-cy="settingsemails-button-addemail"
            >
              Add another email
            </Button>
          ) : (
            <AddEmailForm
              onComplete={() => setShowAddEmailForm(false)}
              error={formError}
              setError={setFormError}
            />
          )}
        </div>
      )}
    </SharedLayoutLoggedIn>
  );
};

const formSchema = z.object({
  email: z
    .string()
    .min(1, "Please enter an email address")
    .email("Please enter a valid email address"),
});
type FormInputs = z.infer<typeof formSchema>;

interface AddEmailFormProps {
  onComplete: () => void;
  error: Error | CombinedError | null;
  setError: (error: Error | CombinedError | null) => void;
}

function AddEmailForm({ error, setError, onComplete }: AddEmailFormProps) {
  const [, addEmail] = useAddEmailMutation();

  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      setError(null);
      try {
        await addEmail({ email: values.email });
        onComplete();
        setError(null);
      } catch (e: any) {
        setError(e);
      }
    },
    [addEmail, onComplete, setError],
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="stack-col items-start gap-4">
          <InputControl
            control={form.control}
            name="email"
            label="New email"
            autoComplete="email"
            data-cy="settingsemails-input-email"
          />

          {error ? (
            <Alert variant="destructive" title="Error: Failed to add email">
              {extractError(error).message}
            </Alert>
          ) : null}

          <Button
            type="submit"
            variant="success"
            isLoading={form.formState.isSubmitting}
            data-cy="settingsemails-button-submit"
          >
            Add email
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default Settings_Emails;
