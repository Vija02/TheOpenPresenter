export type Project = {
  document: Buffer;
  name: string;
  targetDate?: Date;
  targetTime?: string;
  categoryName?: string;
};

export type Media = {
  id: string;
  media_name: string;
  file_size?: number;
  file_offset: number;
  original_name?: string;
  file_extension?: string;
};
