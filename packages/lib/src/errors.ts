import { GraphQLError, GraphQLFormattedError } from "graphql";
import { CombinedError } from "urql";

export function extractError(error: null): null;
export function extractError(error: Error): Error;
export function extractError(error: CombinedError): GraphQLError;
export function extractError(error: GraphQLError): GraphQLError;
export function extractError(
  error: null | Error | CombinedError | GraphQLError,
): null | Error | GraphQLError;
export function extractError(
  error: null | Error | CombinedError | GraphQLError,
): null | Error | GraphQLFormattedError {
  return (
    (error &&
      "graphQLErrors" in error &&
      error.graphQLErrors &&
      error.graphQLErrors.length &&
      error.graphQLErrors[0]) ||
    error
  );
}

export function getExceptionFromError(
  error: null | Error | CombinedError | GraphQLError,
): Error | null {
  // @ts-ignore
  const graphqlError: GraphQLError = extractError(error);
  const exception =
    graphqlError &&
    graphqlError.extensions &&
    graphqlError.extensions.exception;
  return exception || graphqlError || error;
}

export function getCodeFromError(
  error: null | Error | CombinedError | GraphQLError,
): null | string {
  const err = getExceptionFromError(error);
  return (err && (err as any)["code"]) || null;
}
