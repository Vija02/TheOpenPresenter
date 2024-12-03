import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Show,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { OverlayToggleComponentProps } from "@repo/ui";
import { Form, Formik } from "formik";
import {
  CheckboxSingleControl,
  SelectControl,
  SubmitButton,
} from "formik-chakra-ui";
import { useCallback, useEffect } from "react";
import { FaBold, FaItalic, FaLink } from "react-icons/fa6";
import { toFormikValidationSchema } from "zod-formik-adapter";

import { getSlideStyle } from "../../../src/slideStyle";
import { SlideStyle, slideStyleValidator } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { SongViewSlides } from "../SongViewSlides";
import NumberInputControlWithUnit from "./NumberInputControlWithUnit";

export type StyleSettingModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {};

const StyleSettingModal = ({
  isOpen,
  onToggle,
  resetData,
  ...props
}: StyleSettingModalPropTypes) => {
  const pluginApi = usePluginAPI();
  const mutablePluginInfo = pluginApi.scene.useValtioData();

  const style = pluginApi.scene.useData((x) => x.pluginData.style);

  const slideStyle = getSlideStyle(style);

  useEffect(() => {
    if (style === undefined) {
      mutablePluginInfo.pluginData.style = {};
    }
  }, [mutablePluginInfo.pluginData, style]);

  const handleSubmit = useCallback(
    (rawData: SlideStyle) => {
      const data = slideStyleValidator.parse(rawData);
      mutablePluginInfo.pluginData.style = { ...data, debugPadding: false };
      resetData?.();
      onToggle?.();
      return Promise.resolve();
    },
    [mutablePluginInfo.pluginData, onToggle, resetData],
  );

  return (
    <Modal
      size={{ base: "full", md: "3xl" }}
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      {...props}
    >
      <ModalOverlay />
      <Formik
        initialValues={{ ...slideStyle, debugPadding: true }}
        validationSchema={toFormikValidationSchema(slideStyleValidator)}
        onSubmit={handleSubmit}
      >
        {({ handleSubmit, values, setFieldValue }) => (
          <Form onSubmit={handleSubmit as any}>
            <ModalContent>
              <ModalHeader px={{ base: 3, md: 6 }}>Slide Styles</ModalHeader>
              <ModalCloseButton />
              <ModalBody px={{ base: 3, md: 6 }}>
                <Flex flexDir={{ base: "column", md: "row" }} gap={3}>
                  <VStack flex={1} alignItems="flex-start">
                    <Heading fontSize="xl" fontWeight="bold">
                      General
                    </Heading>
                    <SelectControl
                      name="isDarkMode"
                      label="Theme"
                      selectProps={{
                        value: values.isDarkMode ? "dark" : "light",
                      }}
                      maxW="md"
                      onChange={(e) => {
                        setFieldValue(
                          "isDarkMode",
                          (e.target as any).value === "dark",
                        );
                      }}
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </SelectControl>

                    <Heading fontSize="xl" fontWeight="bold" mt={5}>
                      Text style
                    </Heading>
                    <FormControl>
                      <FormLabel>Font Type</FormLabel>
                      <Stack
                        direction="row"
                        alignItems="center"
                        marginBottom={2}
                        flexWrap="wrap"
                      >
                        {[
                          {
                            title: "Auto fit",
                            description:
                              "Fit your lyrics in the available space",
                            val: true,
                          },
                          {
                            title: "Manual",
                            description: "Manually set the size of your fonts",
                            val: false,
                          },
                        ].map(({ title, description, val }, i) => (
                          <Box
                            key={i}
                            cursor="pointer"
                            border="1px solid"
                            borderColor={
                              values.autoSize === val ? "blue.400" : "gray.200"
                            }
                            rounded="sm"
                            p={2}
                            _hover={{ borderColor: "blue.400" }}
                            onClick={() => {
                              setFieldValue("autoSize", val);
                            }}
                          >
                            <Text fontWeight="bold" fontSize="md">
                              {title}
                            </Text>
                            <Text fontSize="sm" color="gray.600">
                              {description}
                            </Text>
                          </Box>
                        ))}
                      </Stack>
                    </FormControl>
                    {!values.autoSize && (
                      <NumberInputControlWithUnit
                        name="fontSize"
                        label="Font Size"
                        maxW="120px"
                        unit="pt"
                        numberInputProps={{
                          min: 0,
                        }}
                      />
                    )}
                    <NumberInputControlWithUnit
                      name="lineHeight"
                      label="Line Height"
                      maxW="120px"
                      numberInputProps={{
                        min: 0,
                        step: 0.1,
                      }}
                    />
                    <FormControl>
                      <Stack direction="row" alignItems="center">
                        <FormLabel mb={0}>Style: </FormLabel>
                        <Button
                          size="sm"
                          bg={
                            values.fontWeight.toString() === "600"
                              ? "gray.100"
                              : "transparent"
                          }
                          variant="outline"
                          onClick={() =>
                            setFieldValue(
                              "fontWeight",
                              values.fontWeight.toString() === "600"
                                ? "400"
                                : "600",
                            )
                          }
                        >
                          <FaBold />
                        </Button>
                        <Button
                          size="sm"
                          bg={
                            values.fontStyle === "italic"
                              ? "gray.100"
                              : "transparent"
                          }
                          variant="outline"
                          onClick={() =>
                            setFieldValue(
                              "fontStyle",
                              values.fontStyle === "normal"
                                ? "italic"
                                : "normal",
                            )
                          }
                        >
                          <FaItalic />
                        </Button>
                      </Stack>
                    </FormControl>

                    <Heading fontSize="xl" fontWeight="bold" mt={5}>
                      Placement
                    </Heading>
                    <Stack direction="row" alignItems="center">
                      <FormLabel mb={0}>Padding</FormLabel>
                      <Button
                        size="sm"
                        bg={values.paddingIsLinked ? "gray.100" : "transparent"}
                        variant="outline"
                        onClick={() =>
                          setFieldValue(
                            "paddingIsLinked",
                            !values.paddingIsLinked,
                          )
                        }
                      >
                        <FaLink />
                      </Button>
                    </Stack>
                    {values.paddingIsLinked ? (
                      <NumberInputControlWithUnit
                        name="padding"
                        maxW="100px"
                        unit="%"
                        numberInputProps={{
                          min: 0,
                          max: 100,
                          step: 0.5,
                        }}
                      />
                    ) : (
                      <Stack direction="row">
                        <NumberInputControlWithUnit
                          name="leftPadding"
                          label="Left"
                          maxW="100px"
                          unit="%"
                          numberInputProps={{
                            min: 0,
                            max: 100,
                            step: 0.5,
                            size: "sm",
                          }}
                          labelProps={{
                            fontSize: "sm",
                          }}
                        />
                        <NumberInputControlWithUnit
                          name="topPadding"
                          label="Top"
                          maxW="100px"
                          unit="%"
                          numberInputProps={{
                            min: 0,
                            max: 100,
                            step: 0.5,
                            size: "sm",
                          }}
                          labelProps={{
                            fontSize: "sm",
                          }}
                        />
                        <NumberInputControlWithUnit
                          name="rightPadding"
                          label="Right"
                          maxW="100px"
                          unit="%"
                          numberInputProps={{
                            min: 0,
                            max: 100,
                            step: 0.5,
                            size: "sm",
                          }}
                          labelProps={{
                            fontSize: "sm",
                          }}
                        />
                        <NumberInputControlWithUnit
                          name="bottomPadding"
                          label="Bottom"
                          maxW="100px"
                          unit="%"
                          numberInputProps={{
                            min: 0,
                            max: 100,
                            step: 0.5,
                            size: "sm",
                          }}
                          labelProps={{
                            fontSize: "sm",
                          }}
                        />
                      </Stack>
                    )}
                  </VStack>
                  <Show above="md">
                    <VStack flexBasis="200px">
                      <Heading fontSize="lg">Preview</Heading>

                      <SongViewSlides
                        song={{
                          id: "",
                          _imported: false,
                          title: "",
                          setting: { displayType: "sections" },
                          content:
                            "[Song 1]\nThen sings my soul\nMy Saviour God to Thee\nHow great Thou art\nHow great Thou art\n\n[Song 2]\nIn Christ alone my hope is found,\nHe is my light, my strength, my song;\n\n[Demo]\nLorem ipsum dolor sit amet\nConsectetur adipiscing elit\nIn fringilla quam non\nmauris ornare condimentum\nSuspendisse in orci nunc",
                        }}
                        slideStyle={values}
                        isPreview
                      />

                      <CheckboxSingleControl
                        name="debugPadding"
                        label="Show Padding"
                        textAlign="center"
                      />
                    </VStack>
                  </Show>
                </Flex>
              </ModalBody>

              <ModalFooter>
                <SubmitButton colorScheme="green">Save</SubmitButton>
                <Button variant="ghost" onClick={onToggle}>
                  Close
                </Button>
              </ModalFooter>
            </ModalContent>
          </Form>
        )}
      </Formik>
    </Modal>
  );
};

export default StyleSettingModal;
