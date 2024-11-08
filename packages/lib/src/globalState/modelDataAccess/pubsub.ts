import { usePublish, useSubscribe } from "use-pubsub-js";

export interface UseSubscriptionParams<T extends string | symbol> {
  token: T;
  handler: (token?: T, message?: string) => void;
  isUnsubscribe?: boolean;
}

export interface IUsePublishParams<
  TokenType extends string | symbol = string | symbol,
> {
  token: TokenType;
  message: string;
  isAutomatic?: boolean;
  isInitialPublish?: boolean;
  isImmediate?: boolean;
  debounceMs?: number | string;
}

export const pubSubEvents = ["page", "tag"] as const;
export type PubSubEvents = (typeof pubSubEvents)[number];

export const useSubscribeAPIChanges = (
  prop: UseSubscriptionParams<PubSubEvents>,
) => {
  return useSubscribe<PubSubEvents>(prop);
};

export const usePublishAPIChanges = (
  prop: Omit<IUsePublishParams<PubSubEvents>, "message"> & { message?: string },
) => {
  return usePublish<PubSubEvents>({ ...prop, message: prop.message ?? "" });
};
