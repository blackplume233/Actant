import type { VfsResolveResult } from "@actant/shared/core";
import type { CanonicalUri, VfsKernelOperation, VfsRequestContext } from "../namespace/canonical-path";

export interface VfsKernelDispatchState {
  operation: VfsKernelOperation;
  path: string;
  uri: CanonicalUri;
  context: VfsRequestContext;
  resolved: VfsResolveResult;
}

export type VfsMiddlewareNext<T> = () => Promise<T>;

export type VfsMiddleware = <T>(
  state: VfsKernelDispatchState,
  next: VfsMiddlewareNext<T>,
) => Promise<T>;
