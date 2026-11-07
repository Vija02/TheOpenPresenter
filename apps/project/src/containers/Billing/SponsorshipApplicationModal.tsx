import { zodResolver } from "@hookform/resolvers/zod";
import { useApplyForSponsorshipMutation } from "@repo/graphql";
import { extractError } from "@repo/lib";
import { captureEvent } from "@repo/observability/initAnalytics";
import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  NumberInputControl,
  TextareaControl,
  useOverlayToggle,
} from "@repo/ui";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { z } from "zod";

const MAX_TEXT = 2000;

const formSchema = z.object({
  weeklyAttendance: z
    .number({ message: "Please enter a number" })
    .int("Please enter a whole number")
    .min(1, "Please enter a number"),
  aboutChurch: z
    .string()
    .trim()
    .min(1, "Please tell us a little about your church")
    .max(MAX_TEXT, `Please keep this under ${MAX_TEXT} characters`),
  intendedUse: z
    .string()
    .trim()
    .max(MAX_TEXT, `Please keep this under ${MAX_TEXT} characters`),
});

type FormInputs = z.infer<typeof formSchema>;

export type SponsorshipApplicationModalPropTypes = {
  organizationId: string;
  onSubmitted?: () => void;
};

const SponsorshipApplicationModal = ({
  organizationId,
  onSubmitted,
}: SponsorshipApplicationModalPropTypes) => {
  const { isOpen, onToggle, resetData } = useOverlayToggle();
  const [, applyForSponsorship] = useApplyForSponsorshipMutation();
  const [error, setError] = useState<Error | null>(null);

  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      weeklyAttendance: undefined,
      aboutChurch: "",
      intendedUse: "",
    },
  });

  const attendance = form.watch("weeklyAttendance");

  const handleSubmit = useCallback(
    async (data: FormInputs) => {
      setError(null);
      try {
        await applyForSponsorship({
          organizationId,
          weeklyAttendance: data.weeklyAttendance,
          aboutChurch: data.aboutChurch,
          intendedUse: data.intendedUse || null,
        });
      } catch (e: any) {
        setError(e);
        return;
      }
      captureEvent("sponsorship_applied", {
        weekly_attendance: data.weeklyAttendance,
      });
      toast.success("Application sent. We'll be in touch soon.");
      onSubmitted?.();
      onToggle?.();
      resetData?.();
    },
    [applyForSponsorship, onSubmitted, onToggle, organizationId, resetData],
  );

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle}>
      <Form {...form}>
        <DialogContent
          className="max-w-lg"
          render={<form onSubmit={form.handleSubmit(handleSubmit)} />}
        >
          <DialogHeader>
            <DialogTitle>Apply for sponsorship</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <p className="text-sm text-secondary">
              Churches under 50 people get the full Cloud plan for free. Tell us
              a little about your church and we'll get back to you by email.
            </p>

            {error && (
              <Alert variant="destructive" title="Couldn't send application">
                {extractError(error).message}
              </Alert>
            )}

            <NumberInputControl
              control={form.control}
              name="weeklyAttendance"
              label="Roughly how many people attend each week?"
              min={1}
              showStepper={false}
              placeholder="e.g. 30"
            />
            {attendance !== undefined && attendance >= 50 && (
              <p className="text-xs text-secondary -mt-2">
                The sponsorship is for churches under 50, but you're welcome to
                apply and tell us about your situation.
              </p>
            )}

            <TextareaControl
              control={form.control}
              name="aboutChurch"
              label="About your church"
              rows={4}
              placeholder="Who you are, where you meet, anything else you'd like us to know"
            />

            <TextareaControl
              control={form.control}
              name="intendedUse"
              label="How will you use TheOpenPresenter? (optional)"
              rows={4}
              placeholder="e.g. To control lyrics and slides with our phones"
            />
          </DialogBody>
          <DialogFooter>
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="success"
                isLoading={form.formState.isSubmitting}
              >
                Send application
              </Button>
              <Button type="button" variant="outline" onClick={onToggle}>
                Cancel
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Form>
    </Dialog>
  );
};

export default SponsorshipApplicationModal;
