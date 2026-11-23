import {
  CategoryEdit,
  CategoryValues,
} from "@/components/Category/CategoryEdit";
import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import {
  categoryNextDate,
  categoryScheduleLabel,
} from "@/lib/categorySchedule";
import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CategoryFragment,
  Exact,
  OrganizationSettingsCategoriesPageQuery,
  OrganizationSettingsCategoriesPageQueryVariables,
  useCategoryTemplateProjectsQuery,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useOrganizationSettingsCategoriesPageQuery,
  useReorderCategoriesMutation,
  useUpdateCategoryMutation,
} from "@repo/graphql";
import { globalState, projectTitle } from "@repo/lib";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useDisclosure,
} from "@repo/ui";
import { format } from "date-fns";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { TbCategory } from "react-icons/tb";
import { VscEdit, VscGripper } from "react-icons/vsc";
import { toast } from "react-toastify";
import { CombinedError, UseQueryResponse } from "urql";

const OrganizationSettingsCategoriesPage = () => {
  const slug = useOrganizationSlug();
  const query = useOrganizationSettingsCategoriesPageQuery({
    variables: { slug },
  });

  const organizationLoadingElement = useOrganizationLoading(query);

  return (
    <SharedOrgLayout title="Categories" sharedOrgQuery={query}>
      {organizationLoadingElement || (
        <OrganizationSettingsCategoriesPageInner query={query} />
      )}
    </SharedOrgLayout>
  );
};

interface OrganizationSettingsCategoriesPageInnerProps {
  query: UseQueryResponse<
    OrganizationSettingsCategoriesPageQuery,
    Exact<OrganizationSettingsCategoriesPageQueryVariables>
  >;
}

const OrganizationSettingsCategoriesPageInner: FC<
  OrganizationSettingsCategoriesPageInnerProps
> = ({ query: [{ data }, refetch] }) => {
  const [error, setError] = useState<CombinedError | null>(null);
  const [editError, setEditError] = useState<CombinedError | null>(null);

  const {
    open: newIsOpen,
    onOpen: newOnOpen,
    onClose: newOnClose,
  } = useDisclosure();
  const [editingCategory, setEditingCategory] =
    useState<CategoryFragment | null>(null);

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const [, createCategory] = useCreateCategoryMutation();
  const [, editCategory] = useUpdateCategoryMutation();
  const [, deleteCategory] = useDeleteCategoryMutation();
  const [, reorderCategories] = useReorderCategoriesMutation();

  const newOnCreate = useCallback(
    async (values: CategoryValues) => {
      try {
        setError(null);
        await createCategory({
          category: { ...values, organizationId: data?.organizationBySlug?.id },
        });
        publish();
        refetch({ requestPolicy: "network-only" });
        toast.success("Category created");
        newOnClose();
      } catch (e: any) {
        setError(e);
      }
    },
    [
      createCategory,
      data?.organizationBySlug?.id,
      publish,
      refetch,
      newOnClose,
    ],
  );

  const onEdit = useCallback(
    async (values: CategoryValues) => {
      try {
        setEditError(null);
        await editCategory({
          id: editingCategory?.id,
          patch: values,
        });
        publish();
        // Making one the default takes it off another
        refetch({ requestPolicy: "network-only" });
        toast.success("Category updated");
        setEditingCategory(null);
      } catch (e: any) {
        setEditError(e);
      }
    },
    [editCategory, editingCategory?.id, publish, refetch],
  );

  const onDeleteCategory = useCallback(
    async (id: string) => {
      try {
        await deleteCategory({
          id,
        });
        publish();
        setEditingCategory(null);
        toast.success("Category deleted");
      } catch (e: any) {
        toast.error("Failed to delete category");
      }
    },
    [deleteCategory, publish],
  );

  const fetched = data?.organizationBySlug?.categories.nodes;
  const slug = useOrganizationSlug();
  const [{ data: projectsData }] = useCategoryTemplateProjectsQuery({
    variables: { slug },
    pause: !newIsOpen && !editingCategory,
  });
  const projects = projectsData?.organizationBySlug?.projects.nodes ?? [];

  // Show a dragged order right away, until the server's order catches up
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const categories = useMemo(() => {
    if (!fetched || !localOrder) return fetched;
    const byId = new Map(fetched.map((c) => [c.id, c]));
    const ordered = localOrder.flatMap((id) => byId.get(id) ?? []);
    return [...ordered, ...fetched.filter((c) => !localOrder.includes(c.id))];
  }, [fetched, localOrder]);
  useEffect(() => setLocalOrder(null), [fetched]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      if (!categories || !over || active.id === over.id) return;
      const ids = categories.map((c) => c.id);
      const reordered = arrayMove(
        ids,
        ids.indexOf(active.id as string),
        ids.indexOf(over.id as string),
      );
      setLocalOrder(reordered);
      try {
        await reorderCategories({ categoryIds: reordered });
        publish();
        refetch({ requestPolicy: "network-only" });
      } catch (e: any) {
        setLocalOrder(null);
        toast.error("Failed to reorder categories");
      }
    },
    [categories, reorderCategories, publish, refetch],
  );

  return (
    <div className="stack-col items-stretch">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold mb-0">Categories</h1>
        {categories && categories.length > 0 && (
          <Button size="sm" variant="success" onClick={newOnOpen}>
            <FiPlus />
            Add Category
          </Button>
        )}
      </div>

      {categories?.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center min-h-[200px] py-10 bg-surface-secondary shadow-md rounded w-full">
          <TbCategory fontSize={40} />
          <h2 className="mt-4 mb-1 text-lg font-bold">
            Welcome to the Categories settings!
          </h2>
          <p className="text-secondary">
            Group projects into categories, and set when they happen and what
            new projects start from.
          </p>
          <Button className="mt-4" variant="success" onClick={newOnOpen}>
            Create a Category
          </Button>
        </div>
      )}

      {categories && categories.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: "40px" }}></TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Starts from</TableHead>
                <TableHead style={{ width: "60px" }}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SortableContext
                items={categories.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {categories.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    onEdit={() => setEditingCategory(category)}
                  />
                ))}
              </SortableContext>
            </TableBody>
          </Table>
        </DndContext>
      )}

      <Dialog open={newIsOpen} onOpenChange={(open) => !open && newOnClose()}>
        {/* The name field focuses itself */}
        <DialogContent
          size="3xl"
          className="overflow-hidden"
          initialFocus={false}
        >
          {newIsOpen && (
            <CategoryEdit
              title="New Category"
              takenNames={fetched?.map((c) => c.name)}
              projects={projects}
              error={error}
              onCreate={newOnCreate}
              onCancel={newOnClose}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingCategory}
        onOpenChange={(open) => !open && setEditingCategory(null)}
      >
        <DialogContent size="3xl" className="overflow-hidden">
          {!!editingCategory && (
            <CategoryEdit
              key={JSON.stringify(editingCategory)}
              initialCategory={editingCategory}
              title="Edit Category"
              takenNames={fetched
                ?.filter((c) => c.id !== editingCategory.id)
                .map((c) => c.name)}
              projects={projects}
              error={editError}
              onCreate={onEdit}
              onCancel={() => setEditingCategory(null)}
              onDelete={() => onDeleteCategory(editingCategory.id)}
              submitText="Save"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const CategoryRow = ({
  category,
  onEdit,
}: {
  category: CategoryFragment;
  onEdit: () => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={
        isDragging ? "relative z-10 bg-surface-primary shadow-md" : undefined
      }
    >
      <TableCell style={{ width: "40px" }}>
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="cursor-grab touch-none p-1 text-secondary active:cursor-grabbing"
          aria-label={`Reorder ${category.name}`}
          {...attributes}
          {...listeners}
        >
          <VscGripper />
        </button>
      </TableCell>
      <TableCell>
        {category.name}
        {category.isDefault && (
          <Badge size="sm" className="ml-2">
            Default
          </Badge>
        )}
        {!category.showInFilter && (
          <p className="text-xs text-tertiary">Hidden from filter</p>
        )}
      </TableCell>
      <TableCell>
        <ScheduleCell category={category} />
      </TableCell>
      <TableCell className="text-secondary">
        {category.templateProject
          ? projectTitle(category.templateProject)
          : "Blank project"}
      </TableCell>
      <TableCell style={{ width: "60px" }}>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Edit category"
          onClick={onEdit}
        >
          <VscEdit className="text-secondary" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

const ScheduleCell = ({ category }: { category: CategoryFragment }) => {
  const label = categoryScheduleLabel(category);
  const next = categoryNextDate(category);
  if (!label) return <span className="text-tertiary">Not set</span>;
  return (
    <div>
      <div>{label}</div>
      {next && (
        <div className="text-xs text-secondary">
          Next: {format(next, "EEE d MMM")}
        </div>
      )}
    </div>
  );
};

export default OrganizationSettingsCategoriesPage;
