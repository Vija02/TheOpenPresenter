import {
  OrganizationType,
  useCreateOrganizationMutation,
  useRequestJoinToOrganizationMutation,
  useSearchPublicOrganizationsQuery,
} from "@repo/graphql";
import {
  extractError,
  getCodeFromError,
  titleCaseOrganizationName,
} from "@repo/lib";
import { captureEvent } from "@repo/observability/initAnalytics";
import {
  Alert,
  Button,
  Checkbox,
  Input,
  Label,
  Link,
  Pagination,
} from "@repo/ui";
import { useCallback, useEffect, useState } from "react";
import { FaCheck } from "react-icons/fa";
import slugify from "slugify";
import { CombinedError } from "urql";
import { useDebounce } from "use-debounce";

export type ChurchStepResult = {
  organizationSlug: string;
  organizationId: string;
};

const RESULTS_PER_PAGE = 5;

export type ChurchStepProps = {
  organizationType: OrganizationType;
  onOrganizationTypeChange: (value: OrganizationType) => void;
  /** To create their personal org */
  userName?: string | null;
  /** Reused instead of creating another one on a second pass through. */
  existingOrganization?: ChurchStepResult | null;
  onDone: (result: ChurchStepResult) => void;
  onDemoCreated: (result: ChurchStepResult) => void;
  onSkipped: (result: ChurchStepResult) => void;
};

export const ChurchStep = ({
  organizationType,
  onOrganizationTypeChange,
  userName,
  existingOrganization,
  onDone,
  onDemoCreated,
  onSkipped,
}: ChurchStepProps) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 200);
  const [page, setPage] = useState(0);
  // Public by default: invite-only is the harder thing to undo socially.
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<Error | CombinedError | null>(null);
  const [busy, setBusy] = useState(false);
  // Requests are one-way, so once sent the row stays marked.
  const [requested, setRequested] = useState<string[]>([]);
  const [lastRequestedName, setLastRequestedName] = useState<string | null>(
    null,
  );

  const [, createOrganization] = useCreateOrganizationMutation();
  const [, requestJoinToOrganization] = useRequestJoinToOrganizationMutation();

  const [{ data: publicOrganizations }] = useSearchPublicOrganizationsQuery({
    variables: {
      search: debouncedSearch,
      first: RESULTS_PER_PAGE,
      offset: page * RESULTS_PER_PAGE,
    },
    pause: debouncedSearch.trim() === "",
  });

  const matches = publicOrganizations?.organizationsPublicSearch?.nodes ?? [];
  const totalMatches =
    publicOrganizations?.organizationsPublicSearch?.totalCount ?? 0;
  const pageCount = Math.ceil(totalMatches / RESULTS_PER_PAGE);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  /** Throws on failure so callers can surface the error. */
  const createOrg = useCallback(
    async (rawName: string, isPublic: boolean, slugSuffix?: string) => {
      const name = titleCaseOrganizationName(rawName);
      const slug =
        slugify(name, { lower: true, strict: true }) +
        (slugSuffix ? `-${slugSuffix}` : "");
      const data = await createOrganization({
        name,
        slug,
        organizationType,
        isPublic,
      });
      const organization = data?.createOrganization?.organization;
      if (!organization) {
        throw new Error("Could not create the organization, please try again");
      }
      captureEvent("organization_created", {
        organization_type: organizationType,
        from_onboarding: true,
        is_personal: !isPublic,
      });
      return organization;
    },
    [createOrganization, organizationType],
  );

  /** A private space of their own, named after them. */
  const createPersonalOrg = useCallback(
    () =>
      createOrg(
        userName ? `${userName} space` : "My space",
        false,
        Math.random().toString(36).slice(2, 8),
      ),
    [createOrg, userName],
  );

  const handleJoin = useCallback(
    async (organizationId: string, organizationName: string) => {
      setError(null);
      setBusy(true);
      try {
        await requestJoinToOrganization({ organizationId });
        captureEvent("onboarding_organization_join_requested");
        setRequested((current) => [...current, organizationId]);
        setLastRequestedName(organizationName);
      } catch (e: any) {
        // A repeat request trips the (organization_id, user_id) unique index, giving NUNIQ
        if (getCodeFromError(e) === "NUNIQ") {
          setRequested((current) => [...current, organizationId]);
          setLastRequestedName(organizationName);
        } else {
          setError(e);
        }
      } finally {
        setBusy(false);
      }
    },
    [requestJoinToOrganization],
  );

  const handleCreate = useCallback(
    async (name: string, isPublic: boolean, slugSuffix?: string) => {
      setError(null);
      setBusy(true);
      try {
        const organization = await createOrg(name, isPublic, slugSuffix);
        onDone({
          organizationSlug: organization.slug,
          organizationId: organization.id,
        });
      } catch (e: any) {
        setError(e);
      } finally {
        setBusy(false);
      }
    },
    [createOrg, onDone],
  );

  /** Makes a personal space only if they don't already have an organization (eg: through back button) */
  const withPersonalOrg = useCallback(
    async (then: (result: ChurchStepResult) => void) => {
      setError(null);
      if (existingOrganization) {
        then(existingOrganization);
        return;
      }
      setBusy(true);
      try {
        const organization = await createPersonalOrg();
        then({
          organizationSlug: organization.slug,
          organizationId: organization.id,
        });
      } catch (e: any) {
        setError(e);
      } finally {
        setBusy(false);
      }
    },
    [existingOrganization, createPersonalOrg],
  );

  const handleSkip = useCallback(
    () => withPersonalOrg(onSkipped),
    [withPersonalOrg, onSkipped],
  );

  const handleDemo = useCallback(
    () => withPersonalOrg(onDemoCreated),
    [withPersonalOrg, onDemoCreated],
  );

  const trimmedSearch = search.trim();
  const code = getCodeFromError(error);

  return (
    <div
      className="stack-col gap-4 w-full"
      data-testid="onboarding-step-church"
    >
      <div className="w-full">
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <Label htmlFor="onboarding-church-name">
            {organizationType === OrganizationType.Church
              ? "Church name"
              : "Organization name"}
          </Label>
          {organizationType === OrganizationType.Church ? (
            <Link
              asChild
              className="text-sm"
              data-testid="onboarding-church-not-church"
            >
              <button
                type="button"
                onClick={() => onOrganizationTypeChange(OrganizationType.Venue)}
              >
                Create a non-church org
              </button>
            </Link>
          ) : (
            <Link asChild className="text-sm">
              <button
                type="button"
                onClick={() =>
                  onOrganizationTypeChange(OrganizationType.Church)
                }
              >
                Create a church account
              </button>
            </Link>
          )}
        </div>

        <Input
          id="onboarding-church-name"
          value={search}
          autoFocus
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            organizationType === OrganizationType.Church
              ? "e.g. Grace Community Church"
              : "e.g. Riverside Conference Centre"
          }
          data-testid="onboarding-church-input"
        />
      </div>

      {trimmedSearch !== "" && (
        <div className="stack-col gap-3 w-full">
          <div className="stack-col gap-3 w-full">
            <div className="flex items-start gap-2">
              <Checkbox
                id="onboarding-church-public"
                checked={isPublic}
                onCheckedChange={(checked) => setIsPublic(checked === true)}
                data-testid="onboarding-church-public"
              />
              <div className="space-y-1 leading-none">
                <Label
                  htmlFor="onboarding-church-public"
                  className="cursor-pointer"
                >
                  Make my organization public
                </Label>
                <p className="text-sm text-secondary">
                  {organizationType === OrganizationType.Church
                    ? "When checked, your volunteers can find your church and request to join. Uncheck this to make it invite-only."
                    : "When checked, your team can find your organization and request to join. Uncheck this to make it invite-only."}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 w-full">
              <Button
                variant="link"
                size="sm"
                className="text-tertiary"
                isLoading={busy}
                onClick={handleSkip}
                data-testid="onboarding-church-skip-inline"
              >
                Skip
              </Button>
              <Button
                variant="success"
                className="shrink-0"
                isLoading={busy}
                onClick={() => handleCreate(trimmedSearch, isPublic)}
                data-testid="onboarding-church-create"
              >
                Create "{titleCaseOrganizationName(trimmedSearch)}"
              </Button>
            </div>
          </div>

          {matches.length > 0 && (
            <>
              <p className="lineText w-full text-tertiary text-xs">OR</p>

              <div className="stack-col items-start gap-1.5 w-full">
                <p className="text-sm font-medium">
                  {organizationType === OrganizationType.Church
                    ? "Join an existing church"
                    : "Join an existing organization"}
                </p>
                <div className="w-full border border-gray-200 rounded-md divide-y divide-gray-100">
                  {matches.map((org) => (
                    <div
                      key={org.id}
                      className="w-full flex items-center justify-between gap-3 py-1.5 px-3"
                      data-testid="onboarding-church-match"
                    >
                      <p className="text-sm truncate">
                        <HighlightedText
                          text={org.name}
                          query={trimmedSearch}
                        />
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={busy || requested.includes(org.id)}
                        onClick={() => handleJoin(org.id, org.name)}
                        data-testid="onboarding-church-request"
                      >
                        {requested.includes(org.id) ? (
                          <>
                            <FaCheck className="size-3" />
                            Requested
                          </>
                        ) : (
                          "Request to join"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
                {pageCount > 1 && (
                  <div className="flex justify-center w-full">
                    <Pagination
                      pageCount={pageCount}
                      forcePage={page}
                      onPageChange={({ selected }) => setPage(selected)}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {lastRequestedName && (
        <Alert
          variant="success"
          title={`Request sent to ${lastRequestedName}`}
          data-testid="onboarding-church-requested"
        >
          <div className="stack-col items-start gap-2">
            <p>You'll get an email as soon as they approve you.</p>
            <p>
              In the meantime,{" "}
              <Link asChild>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleDemo}
                  data-testid="onboarding-church-demo"
                >
                  create a demo to play with
                </button>
              </Link>
              .
            </p>
          </div>
        </Alert>
      )}

      {error ? (
        <Alert variant="destructive" title="That didn't work">
          <div className="block">
            {code === "NUNIQ" ? (
              <span>
                That name is already taken. Try adding your town or city to it.
              </span>
            ) : code === "ISMBR" ? (
              <span>You're already a member of this one.</span>
            ) : code === "VRFY2" ? (
              <span>
                Please verify your email address first, then you can ask to
                join.
              </span>
            ) : (
              extractError(error).message
            )}
          </div>
        </Alert>
      ) : null}

      {!lastRequestedName && (
        <div className="pt-4 flex justify-center">
          <Button
            variant="link"
            size="sm"
            className="text-tertiary"
            isLoading={busy}
            onClick={handleSkip}
            data-testid="onboarding-church-skip"
          >
            Skip for now
          </Button>
        </div>
      )}
    </div>
  );
};

/** Emphasises each occurrence of `query`, so it's obvious why a result matched. */
const HighlightedText = ({ text, query }: { text: string; query: string }) => {
  const trimmed = query.trim();
  if (trimmed === "") return <>{text}</>;

  // The query is user input, so escape it before it reaches a regex.
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark key={i} className="bg-yellow-100 text-inherit font-semibold">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
};
