import { ApolloError } from "@apollo/client";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Flex,
  FormLabel,
  HStack,
  VStack,
} from "@chakra-ui/react";
import { TagFragment } from "@repo/graphql";
import { extractError } from "@repo/lib";
import { Form, Formik, FormikHelpers } from "formik";
import { InputControl, SelectControl } from "formik-chakra-ui";
import React, { useCallback } from "react";
import * as Yup from "yup";

import { Tag } from "./Tag";

export type TagType = Pick<
  TagFragment,
  "name" | "description" | "backgroundColor" | "foregroundColor" | "variant"
>;

export type TagEditPropTypes = {
  initialTag: TagType;
  onCreate: (tag: TagType) => Promise<any>;
  onCancel: () => void;
  error: ApolloError | null;
  submitText?: string;
};

const validationSchema = Yup.object({
  name: Yup.string()
    .min(1, "Tag name must not be empty")
    .required("Tag name is required"),
  description: Yup.string().optional(),
  backgroundColor: Yup.string().optional(),
  foregroundColor: Yup.string().optional(),
  variant: Yup.string().optional(),
});

export function TagEdit({
  initialTag,
  onCreate,
  onCancel,
  error,
  submitText = "Create",
}: TagEditPropTypes) {
  const handleCreate = useCallback(
    (values: TagType, { resetForm }: FormikHelpers<any>) => {
      onCreate(values).then((res) => {
        resetForm();
        return res;
      });
    },
    [onCreate],
  );

  return (
    <Formik
      initialValues={initialTag}
      onSubmit={handleCreate}
      validationSchema={validationSchema}
    >
      {({ handleSubmit, values }) => (
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
                  label="Tag Name"
                  inputProps={{ placeholder: "Tag Name" }}
                />
                <InputControl
                  name="description"
                  label="Description"
                  inputProps={{ placeholder: "Description (optional)" }}
                />

                <InputControl name="backgroundColor" label="Background Color" />

                <Accordion width="100%" allowToggle>
                  <AccordionItem border="none">
                    <AccordionButton>
                      <Box flex="1" textAlign="left">
                        Advanced
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel pb={4}>
                      <VStack alignItems="flex-start">
                        <InputControl
                          name="foregroundColor"
                          label="Foreground Color"
                        />
                        <SelectControl
                          label="Variant"
                          name="variant"
                          selectProps={{ placeholder: "Select variant" }}
                        >
                          <option value="solid">Solid</option>
                          <option value="outline">Outline</option>
                        </SelectControl>
                      </VStack>
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
              </VStack>
              <VStack
                minWidth="200px"
                flex={1}
                flexShrink={1}
                justifyContent="center"
              >
                <FormLabel>Preview</FormLabel>
                <Tag tag={values} placeholder="Preview Tag" />
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
