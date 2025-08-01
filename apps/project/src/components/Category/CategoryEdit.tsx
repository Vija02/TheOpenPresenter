import { ApolloError } from "@apollo/client";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Flex,
  HStack,
  VStack,
} from "@chakra-ui/react";
import { CategoryFragment } from "@repo/graphql";
import { extractError } from "@repo/lib";
import { Form, Formik, FormikHelpers } from "formik";
import { InputControl } from "formik-chakra-ui";
import { useCallback } from "react";
import * as Yup from "yup";

export type CategoryType = Pick<CategoryFragment, "name">;

export type CategoryEditPropTypes = {
  initialCategory: CategoryType;
  onCreate: (category: CategoryType) => Promise<any>;
  onCancel: () => void;
  error: ApolloError | null;
  submitText?: string;
};

const validationSchema = Yup.object({
  name: Yup.string()
    .min(1, "Name must not be empty")
    .required("Name is required"),
});

export function CategoryEdit({
  initialCategory,
  onCreate,
  onCancel,
  error,
  submitText = "Create",
}: CategoryEditPropTypes) {
  const handleCreate = useCallback(
    (values: CategoryType, { resetForm }: FormikHelpers<any>) => {
      onCreate(values).then((res) => {
        resetForm();
        return res;
      });
    },
    [onCreate],
  );

  return (
    <Formik
      initialValues={initialCategory}
      onSubmit={handleCreate}
      validationSchema={validationSchema}
    >
      {({ handleSubmit }) => (
        <Form onSubmit={handleSubmit as any}>
          <VStack spacing={5}>
            <Flex width="100%" flexWrap="wrap">
              <VStack
                minWidth="200px"
                flex={1}
                flexShrink={1}
                alignItems="flex-start"
              >
                <InputControl
                  name="name"
                  label="Name"
                  inputProps={{ placeholder: "Name" }}
                />
              </VStack>
            </Flex>

            {error ? (
              <Alert status="error">
                <AlertIcon />
                <Box flex="1">
                  <AlertTitle mr={2}>
                    Error performing this operation
                  </AlertTitle>
                  <AlertDescription display="block">
                    {extractError(error).message}
                  </AlertDescription>
                </Box>
              </Alert>
            ) : null}
            <HStack alignSelf="flex-start">
              <Button colorScheme="green" type="submit">
                {submitText}
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </HStack>
          </VStack>
        </Form>
      )}
    </Formik>
  );
}
