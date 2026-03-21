import { VideoTranscodeStatus } from "@repo/graphql";
import type { Meta, StoryObj } from "@storybook/react";

import { MediaPreview, MediaPreviewData } from "../MediaPreview";

const meta = {
  title: "Media/MediaPreview",
  component: MediaPreview,
  tags: ["autodocs"],
  argTypes: {
    className: {
      control: { type: "text" },
      description: "CSS class for the container",
    },
    mediaClassName: {
      control: { type: "text" },
      description: "CSS class for the media element",
    },
    iconClassName: {
      control: { type: "text" },
      description: "CSS class for the fallback icon",
    },
    processedImageSize: {
      control: { type: "number" },
      description: "Size for processed image URL",
    },
  },
} satisfies Meta<typeof MediaPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockImageMedia: MediaPreviewData = {
  mediaName: "media_01km6vn858fanbvfzc4p7wxm20.jpg",
  originalName: "My Photo.jpg",
  fileExtension: ".jpg",
};

const mockVideoWithThumbnail: MediaPreviewData = {
  mediaName: "media_01km6vn85bfanbvfzs9tx42dzs.mp4",
  originalName: "My Video.mp4",
  fileExtension: ".mp4",
  videoMetadata: {
    thumbnailMediaId: "019d0dba-a0ab-7aaa-bdc0-24a37e89679f",
    hlsMediaId: null,
    transcodeStatus: VideoTranscodeStatus.Completed,
  },
};

const mockVideoProcessing: MediaPreviewData = {
  mediaName: "media_01km6vn85bfanbvfzqp67a6d3v.mp4",
  originalName: "Processing Video.mp4",
  fileExtension: ".mp4",
  videoMetadata: {
    thumbnailMediaId: "019d0dba-a0ab-7aaa-bdc0-24a37e89679f",
    hlsMediaId: null,
    transcodeStatus: VideoTranscodeStatus.Processing,
    transcodeProgress: 45,
  },
};

const mockAudioMedia: MediaPreviewData = {
  mediaName: "media_01km6vn85bfanbvg039fghm1p3.mp3",
  originalName: "My Song.mp3",
  fileExtension: ".mp3",
};

const mockPdfMedia: MediaPreviewData = {
  mediaName: "media_01km6vn85bfanbvg09p0kbnpke.pdf",
  originalName: "My Document.pdf",
  fileExtension: ".pdf",
};

const PreviewContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="w-64 h-48 border border-gray-300 rounded-lg overflow-hidden">
    {children}
  </div>
);

export const Image: Story = {
  args: {
    media: mockImageMedia,
    className: "size-full",
  },
  render: (args) => (
    <PreviewContainer>
      <MediaPreview {...args} />
    </PreviewContainer>
  ),
};

export const VideoWithThumbnail: Story = {
  args: {
    media: mockVideoWithThumbnail,
    className: "size-full",
  },
  render: (args) => (
    <PreviewContainer>
      <MediaPreview {...args} />
    </PreviewContainer>
  ),
};

export const VideoProcessing: Story = {
  args: {
    media: mockVideoProcessing,
    className: "size-full",
  },
  render: (args) => (
    <PreviewContainer>
      <MediaPreview {...args} />
    </PreviewContainer>
  ),
};

export const FallbackIcon: Story = {
  args: {
    media: mockAudioMedia,
    className: "size-full",
  },
  render: () => (
    <div className="flex gap-4">
      <div>
        <p className="text-sm text-gray-600 mb-2">Audio</p>
        <PreviewContainer>
          <MediaPreview media={mockAudioMedia} className="size-full" />
        </PreviewContainer>
      </div>
      <div>
        <p className="text-sm text-gray-600 mb-2">PDF</p>
        <PreviewContainer>
          <MediaPreview media={mockPdfMedia} className="size-full" />
        </PreviewContainer>
      </div>
    </div>
  ),
};
