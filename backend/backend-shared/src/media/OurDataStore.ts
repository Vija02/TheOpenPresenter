import { DataStore } from "@tus/server";

export interface OurDataStore extends DataStore {
  complete(id: string): Promise<void>;
}
