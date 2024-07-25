import { initTRPC } from "@trpc/server";

import { IDisposable, ObjectToTypedMap, Plugin } from "../types";

export class ServerPluginApi {
  protected registeredTrpcAppRouter: ((
    t: ReturnType<typeof initTRPC.create>,
  ) => any)[] = [];
  protected registeredOnPluginDataLoaded: {
    pluginName: string;
    callback: (entryData: ObjectToTypedMap<Plugin>) => IDisposable;
  }[] = [];
  protected registeredServeStatic: {
    pluginName: string;
    path: string;
  }[] = [];
  protected registeredLoadJsOnRemoteView: {
    pluginName: string;
    path: string;
  }[] = [];
  protected registeredRemoteViewWebComponent: {
    pluginName: string;
    webComponentTag: string;
  }[] = [];

  public registerTrpcAppRouter(
    getAppRouter: (t: ReturnType<typeof initTRPC.create>) => any,
  ) {
    this.registeredTrpcAppRouter.push(getAppRouter);
  }

  public onPluginDataLoaded(
    pluginName: string,
    callback: (entryData: ObjectToTypedMap<Plugin>) => IDisposable,
  ) {
    this.registeredOnPluginDataLoaded.push({ pluginName, callback });
  }

  public serveStatic(pluginName: string, path: string) {
    this.registeredServeStatic.push({ pluginName, path });
  }

  public loadJsOnRemoteView(pluginName: string, path: string) {
    this.registeredLoadJsOnRemoteView.push({ pluginName, path });
  }

  public registerRemoteViewWebComponent(
    pluginName: string,
    webComponentTag: string,
  ) {
    this.registeredRemoteViewWebComponent.push({ pluginName, webComponentTag });
  }
}
