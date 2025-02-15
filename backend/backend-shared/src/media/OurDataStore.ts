import { DataStore } from "@tus/server";
import { Readable } from "node:stream";

export interface OurDataStore extends DataStore {
  complete(id: string): Promise<void>;
  getReadable(id: string): Promise<Readable>;
}
