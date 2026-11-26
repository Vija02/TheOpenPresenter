import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
import {
  OrganizationFontsQuery,
  useAddGoogleFontMutation,
  useDeleteMediaMutation,
  useGoogleFontCatalogQuery,
  useOrganizationFontsQuery,
  useOrganizationSettingsFontsPageQuery,
} from "@repo/graphql";
import {
  BUNDLED_FONTS,
  FontOption,
  SYSTEM_FONTS,
  organizationFontStack,
  setOrganizationFonts,
} from "@repo/layout";
import { ensureFontsLoaded } from "@repo/layout/react";
import "@repo/layout/react/css";
import {
  DEFAULT_PREVIEW_SIZE,
  FONT_CATEGORY_LABELS,
  FontSampleRow,
  GOOGLE_CATEGORY_FILTERS,
  GoogleFont,
  GoogleFontList,
  GoogleFontSort,
  LATIN_SAMPLE,
  PREVIEW_TEXT_DEBOUNCE_MS,
  filterGoogleFonts,
  googleCategoryOf,
  useDebounced,
} from "@repo/media-picker/client";
import {
  Badge,
  Button,
  Input,
  PopConfirm,
  Sheet,
  SheetClose,
  SheetContent,
  Slider,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
  useIsMobile,
} from "@repo/ui";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { FiPlus, FiSearch, FiSliders } from "react-icons/fi";
import { VscTrash } from "react-icons/vsc";
import { toast } from "react-toastify";

const OrganizationSettingsFontsPage = () => {
  const slug = useOrganizationSlug();
  const query = useOrganizationSettingsFontsPageQuery({
    variables: { slug },
  });

  const organizationLoadingElement = useOrganizationLoading(query);
  const organizationId = query[0].data?.organizationBySlug?.id;
  const isMobile = useIsMobile();
  const controls = useFontControls(
    isMobile ? MOBILE_PREVIEW_SIZE : DEFAULT_PREVIEW_SIZE,
  );

  return (
    <SharedOrgLayout
      title="Fonts"
      sharedOrgQuery={query}
      rightPanel={organizationId && <FontOptionsPanel controls={controls} />}
    >
      {organizationLoadingElement ||
        (organizationId && (
          <>
            <FontsInner organizationId={organizationId} controls={controls} />
            {isMobile && <MobileFontOptions controls={controls} />}
          </>
        ))}
    </SharedOrgLayout>
  );
};

const MobileFontOptions = ({ controls }: { controls: FontControls }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        className="fixed right-4 bottom-4 z-10 rounded-full shadow-lg stack-row"
        onClick={() => setOpen(true)}
      >
        <FiSliders />
        Preview
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          hideCloseButton
          className="max-h-[85dvh] overflow-y-auto p-0"
        >
          <FontOptionsPanel controls={controls} />
          <div className="px-5 pb-5">
            <SheetClose render={<Button className="w-full" />}>Done</SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

const SAMPLE_PRESETS = [
  { label: "Sentence", text: "" },
  {
    label: "Alphabet",
    text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz",
  },
  { label: "Numbers", text: "0123456789 !?&@#%()" },
];

const MIN_SIZE = 16;
const MAX_SIZE = 96;
const MOBILE_PREVIEW_SIZE = 24;

const useFontControls = (defaultSize: number) => {
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<GoogleFontSort>("popular");
  const [previewText, setPreviewText] = useState("");
  // Null follows the default, which depends on the screen width
  const [chosenSize, setSize] = useState<number | null>(null);
  return {
    category,
    setCategory,
    sort,
    setSort,
    previewText,
    setPreviewText,
    size: chosenSize ?? defaultSize,
    isDefaultSize: chosenSize === null,
    setSize,
  };
};

type FontControls = ReturnType<typeof useFontControls>;

const FontOptionsPanel = ({ controls }: { controls: FontControls }) => {
  const {
    category,
    setCategory,
    sort,
    setSort,
    previewText,
    setPreviewText,
    size,
    isDefaultSize,
    setSize,
  } = controls;
  const isDefault =
    !previewText && !category && sort === "popular" && isDefaultSize;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="font-bold">Preview</h2>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-tertiary"
          disabled={isDefault}
          onClick={() => {
            setPreviewText("");
            setCategory("");
            setSort("popular");
            setSize(null);
          }}
        >
          Reset
        </Button>
      </div>

      <PanelGroup label="Text">
        <Textarea
          rows={3}
          className="resize-none bg-surface-primary"
          placeholder="Type something to see it in every font"
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value.replace(/\n/g, " "))}
        />
        <div className="bp--font-chips">
          {SAMPLE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`bp--font-chip ${
                previewText === p.text ? "bp--font-chip--active" : ""
              }`}
              onClick={() => setPreviewText(p.text)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </PanelGroup>

      <PanelGroup label="Size" value={`${size}px`}>
        <Slider
          min={MIN_SIZE}
          max={MAX_SIZE}
          step={2}
          value={[size]}
          onValueChange={([v]) => v && setSize(v)}
          aria-label="Preview size"
        />
      </PanelGroup>

      <PanelGroup label="Category">
        <div className="bp--font-chips">
          {GOOGLE_CATEGORY_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`bp--font-chip ${
                category === f.value ? "bp--font-chip--active" : ""
              }`}
              aria-pressed={category === f.value}
              onClick={() => setCategory(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </PanelGroup>

      <PanelGroup label="Sort Google Fonts">
        <ToggleGroup
          type="single"
          size="sm"
          className="w-full"
          value={sort}
          onValueChange={(v) => v && setSort(v as GoogleFontSort)}
        >
          <ToggleGroupItem className="flex-1" value="popular">
            Popular
          </ToggleGroupItem>
          <ToggleGroupItem className="flex-1" value="name">
            Name
          </ToggleGroupItem>
        </ToggleGroup>
      </PanelGroup>

      <p className="px-5 py-5 text-xs text-tertiary">
        Fonts you add are saved to your organization and can be used everywhere.
      </p>
    </div>
  );
};

const PanelGroup = ({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-3 px-5 py-4 border-t border-stroke">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-wide text-tertiary">
        {label}
      </span>
      {value && <span className="text-xs text-secondary">{value}</span>}
    </div>
    {children}
  </div>
);

type OrganizationFont = NonNullable<
  OrganizationFontsQuery["organizationFonts"]
>["nodes"][number];

const categoryLabel = (category: string) =>
  FONT_CATEGORY_LABELS[category] ?? category;

const FontsInner = ({
  organizationId,
  controls,
}: {
  organizationId: string;
  controls: FontControls;
}) => {
  const { category, sort, previewText, size } = controls;
  const [{ data, fetching }, refetch] = useOrganizationFontsQuery({
    variables: { organizationId },
  });
  const [{ data: catalogData, error: catalogError }] =
    useGoogleFontCatalogQuery();
  const [, deleteMedia] = useDeleteMediaMutation();
  const [, addGoogleFont] = useAddGoogleFontMutation();

  const [search, setSearch] = useState("");
  const debouncedText = useDebounced(previewText, PREVIEW_TEXT_DEBOUNCE_MS);
  const [adding, setAdding] = useState<Set<string>>(new Set());

  // A family added on two instances before syncing exists twice; one row,
  // and removing it removes every copy
  const fonts = useMemo(() => {
    const byFamily = new Map<string, OrganizationFont & { copies: string[] }>();
    for (const node of data?.organizationFonts?.nodes ?? []) {
      const key = node.family.toLowerCase();
      const existing = byFamily.get(key);
      if (existing) existing.copies.push(node.fontMediaId);
      else byFamily.set(key, { ...node, copies: [node.fontMediaId] });
    }
    return [...byFamily.values()];
  }, [data]);
  const catalog = catalogData?.googleFontCatalog;
  const sample = previewText.trim() ? previewText : LATIN_SAMPLE;
  const added = useMemo(
    () => new Set(fonts.map((f) => f.family.toLowerCase())),
    [fonts],
  );
  const bundled = useMemo(
    () => new Set(BUNDLED_FONTS.map((f) => f.label.toLowerCase())),
    [],
  );

  // Load every face so each sample shows in its own font
  useEffect(() => {
    const loaded = fonts.flatMap((f) =>
      f.cssUrl
        ? [{ family: f.family, category: f.category, cssUrl: f.cssUrl }]
        : [],
    );
    setOrganizationFonts(loaded);
    ensureFontsLoaded([
      ...BUNDLED_FONTS.map((f) => f.stack),
      ...loaded.map((f) => organizationFontStack(f.family, f.category)),
    ]);
  }, [fonts]);

  const matches = useCallback(
    (family: string, ourCategory: string) =>
      family.toLowerCase().includes(search.trim().toLowerCase()) &&
      (!category ||
        googleCategoryOf(family, ourCategory, catalog) === category),
    [search, category, catalog],
  );

  const yourFonts = fonts.filter((f) => matches(f.family, f.category));
  const builtIn = BUNDLED_FONTS.filter((f) => matches(f.label, f.category));
  const system = SYSTEM_FONTS.filter((f) => matches(f.label, f.category));
  const googleFonts = useMemo(
    () => filterGoogleFonts(catalog, { search, category, sort }),
    [catalog, search, category, sort],
  );
  const isFiltering = !!search.trim() || !!category;

  const reload = useCallback(
    () => refetch({ requestPolicy: "network-only" }),
    [refetch],
  );

  const onAdd = async (font: GoogleFont) => {
    setAdding((s) => new Set(s).add(font.family));
    try {
      await addGoogleFont({ organizationId, family: font.family });
      toast.success(`${font.family} added`);
      reload();
    } catch {
      toast.error(
        `Couldn't add ${font.family}. Check your internet and try again.`,
      );
    } finally {
      setAdding((s) => {
        const next = new Set(s);
        next.delete(font.family);
        return next;
      });
    }
  };

  const onDelete = async (ids: string[], family: string) => {
    try {
      for (const id of ids) await deleteMedia({ id });
      toast.success(`${family} removed`);
      reload();
    } catch {
      toast.error("Couldn't remove this font. Please try again.");
    }
  };

  const localRow = (font: FontOption) => (
    <FontSampleRow
      key={font.id}
      name={font.label}
      details={[categoryLabel(font.category)]}
      fontFamily={font.stack}
      sample={sample}
      size={size}
    />
  );

  const nothingMatches =
    isFiltering &&
    yourFonts.length + builtIn.length + system.length + googleFonts.length ===
      0;

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <div>
        <h1 className="text-2xl font-bold">Fonts</h1>
      </div>

      <div className="bp--font-dialog__search-field">
        <FiSearch />
        <Input
          placeholder="Search fonts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {nothingMatches && (
        <p className="text-secondary py-10 text-center">No fonts match.</p>
      )}

      {(yourFonts.length > 0 || !isFiltering) && (
        <FontSection
          title="Your fonts"
          description="Added by your organization."
        >
          {!fetching && fonts.length === 0 && (
            <p className="text-sm text-secondary py-4">
              Nothing added yet. Pick any font from Google Fonts below.
            </p>
          )}
          {yourFonts.map((font) => (
            <FontSampleRow
              key={font.fontMediaId}
              name={font.family}
              details={[categoryLabel(font.category), "Google Fonts"]}
              fontFamily={organizationFontStack(font.family, font.category)}
              sample={sample}
              size={size}
              action={
                <PopConfirm
                  title={`Remove ${font.family}?`}
                  onConfirm={() => onDelete(font.copies, font.family)}
                  description="Slides that use it will show a similar font instead."
                  okText="Remove"
                  cancelText="Cancel"
                >
                  <Button variant="ghost" size="sm" title="Remove font">
                    <VscTrash className="text-secondary" />
                  </Button>
                </PopConfirm>
              }
            />
          ))}
        </FontSection>
      )}

      {builtIn.length > 0 && (
        <FontSection
          title="Built in"
          description="Included with TheOpenPresenter."
        >
          {builtIn.map(localRow)}
        </FontSection>
      )}

      {system.length > 0 && (
        <FontSection
          title="System"
          description="Uses the copy installed on each screen, so it can look slightly different between devices."
        >
          {system.map(localRow)}
        </FontSection>
      )}

      {(googleFonts.length > 0 || !catalog) && (
        <FontSection
          title="Google Fonts"
          description={
            catalog
              ? `${googleFonts.length.toLocaleString()} of ${catalog.length.toLocaleString()} families`
              : undefined
          }
        >
          {!catalog && !catalogError && (
            <p className="text-sm text-secondary py-4">Loading fonts…</p>
          )}
          {catalogError && (
            <p className="text-sm text-secondary py-4">
              Couldn't load Google Fonts. You need internet to add a font.
            </p>
          )}
          <GoogleFontList
            fonts={googleFonts}
            previewText={debouncedText}
            size={size}
            renderAction={(f) =>
              bundled.has(f.family.toLowerCase()) ? (
                <Badge size="sm">Built in</Badge>
              ) : added.has(f.family.toLowerCase()) ? (
                <Badge variant="success" size="sm">
                  Added
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="stack-row"
                  disabled={adding.has(f.family)}
                  onClick={() => onAdd(f)}
                >
                  <FiPlus />
                  {adding.has(f.family) ? "Adding…" : "Add"}
                </Button>
              )
            }
          />
        </FontSection>
      )}
    </div>
  );
};

const FontSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) => (
  <section className="flex flex-col">
    <div className="mb-1">
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="text-sm text-tertiary">{description}</p>}
    </div>
    {children}
  </section>
);

export default OrganizationSettingsFontsPage;
