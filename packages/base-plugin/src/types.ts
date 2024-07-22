export type UUID = string;

export type Section = {
  name: string;
  type: "section";
  order: number;
};

export type Scene<T = Record<string, any>> = {
  name: string;
  type: "scene";
  order: number;
  plugin: string;
  data: T;
};

export type State = {
  meta: {
    id: UUID;
    name: string;
    createdAt: string;
  };
  data: Record<UUID, Section | Scene>;
};

export interface IDisposable {
  dispose?(): void;
}
