import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Pagination } from "../pagination";

const meta: Meta<typeof Pagination> = {
  title: "Primitive/Pagination",
  component: Pagination,
  tags: ["autodocs"],
  argTypes: {
    pageCount: {
      control: { type: "number", min: 1, max: 100 },
    },
    pageRangeDisplayed: {
      control: { type: "number", min: 1, max: 10 },
    },
    marginPagesDisplayed: {
      control: { type: "number", min: 0, max: 5 },
    },
  },
};

export default meta;

type Story = StoryObj<typeof Pagination>;

export const Default: Story = {
  render: (args) => {
    const [currentPage, setCurrentPage] = useState(0);

    return (
      <Pagination
        {...args}
        forcePage={currentPage}
        onPageChange={(page) => setCurrentPage(page.selected)}
      />
    );
  },
  args: {
    pageCount: 10,
  },
};

export const LargeDataset: Story = {
  render: (args) => {
    const [currentPage, setCurrentPage] = useState(0);

    return (
      <Pagination
        {...args}
        forcePage={currentPage}
        onPageChange={(page) => setCurrentPage(page.selected)}
      />
    );
  },
  args: {
    pageCount: 100,
    pageRangeDisplayed: 5,
    marginPagesDisplayed: 2,
  },
};
