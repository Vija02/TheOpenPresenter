import { media } from "@repo/backend-shared";
import { Express, RequestHandler } from "express";
import stream from "stream";

import { SceneCategories } from "../types";
import {
  RegisterKeyPressHandlerCallback,
  RegisterOnPluginDataCreated,
  RegisterOnPluginDataLoaded,
  RegisterOnRendererDataCreated,
  RegisterOnRendererDataLoaded,
  RemoteViewWebComponentConfig,
} from "./serverPluginTypes";
import { TRPCObject } from "./types";

export class ServerPluginApi<PluginDataType = any, RendererDataType = any> {
  protected registeredTrpcAppRouter: ((t: TRPCObject) => any)[] = [];
  protected registeredOnPluginDataCreated: {
    pluginName: string;
    callback: RegisterOnPluginDataCreated<PluginDataType>;
  }[] = [];
  protected registeredOnPluginDataLoaded: {
    pluginName: string;
    callback: RegisterOnPluginDataLoaded<PluginDataType>;
  }[] = [];
  protected registeredOnRendererDataCreated: {
    pluginName: string;
    callback: RegisterOnRendererDataCreated<RendererDataType>;
  }[] = [];
  protected registeredOnRendererDataLoaded: {
    pluginName: string;
    callback: RegisterOnRendererDataLoaded<RendererDataType>;
  }[] = [];
  protected registeredServeStatic: {
    pluginName: string;
    path: string;
  }[] = [];
  protected registeredLoadJsOnRemoteView: {
    pluginName: string;
    path: string;
  }[] = [];
  protected registeredLoadCssOnRemoteView: {
    pluginName: string;
    path: string;
  }[] = [];
  protected registeredRemoteViewWebComponent: {
    pluginName: string;
    webComponentTag: string;
    config?: RemoteViewWebComponentConfig;
  }[] = [];
  protected registeredLoadJsOnRendererView: {
    pluginName: string;
    path: string;
  }[] = [];
  protected registeredLoadCssOnRendererView: {
    pluginName: string;
    path: string;
  }[] = [];
  protected registeredRendererViewWebComponent: {
    pluginName: string;
    webComponentTag: string;
  }[] = [];
  protected registeredSceneCreator: {
    pluginName: string;
    sceneCreatorMeta: {
      title: string;
      description: string;
      categories: SceneCategories[];
      isExperimental?: boolean;
      isStarred?: boolean;
    };
  }[] = [];
  protected registeredPrivateRoute: {
    pluginName: string;
    path: string;
    middleware: RequestHandler;
  }[] = [];
  protected registeredKeyPressHandler: {
    pluginName: string;
    callback: RegisterKeyPressHandlerCallback<PluginDataType, RendererDataType>;
  }[] = [];
  protected registeredCSPDirectives: {
    pluginName: string;
    cspDirective: any;
  }[] = [];
  protected registeredEnvToViews: {
    pluginName: string;
    envVars: Record<string, string>;
  }[] = [];

  private app: Express;

  public constructor(app: Express) {
    this.app = app;
  }

  public registerTrpcAppRouter(getAppRouter: (t: TRPCObject) => any) {
    this.registeredTrpcAppRouter.push(getAppRouter);
  }

  public onPluginDataCreated(
    pluginName: string,
    callback: RegisterOnPluginDataCreated<PluginDataType>,
  ) {
    this.registeredOnPluginDataCreated.push({ pluginName, callback });
  }

  public onPluginDataLoaded(
    pluginName: string,
    callback: RegisterOnPluginDataLoaded<PluginDataType>,
  ) {
    this.registeredOnPluginDataLoaded.push({ pluginName, callback });
  }

  public onRendererDataCreated(
    pluginName: string,
    callback: RegisterOnRendererDataCreated<RendererDataType>,
  ) {
    this.registeredOnRendererDataCreated.push({ pluginName, callback });
  }

  public onRendererDataLoaded(
    pluginName: string,
    callback: RegisterOnRendererDataLoaded<RendererDataType>,
  ) {
    this.registeredOnRendererDataLoaded.push({ pluginName, callback });
  }

  public serveStatic(pluginName: string, path: string) {
    this.registeredServeStatic.push({ pluginName, path });
  }

  public loadJsOnRemoteView(pluginName: string, path: string) {
    this.registeredLoadJsOnRemoteView.push({ pluginName, path });
  }

  public loadCssOnRemoteView(pluginName: string, path: string) {
    this.registeredLoadCssOnRemoteView.push({ pluginName, path });
  }

  public registerRemoteViewWebComponent(
    pluginName: string,
    webComponentTag: string,
    config?: RemoteViewWebComponentConfig,
  ) {
    this.registeredRemoteViewWebComponent.push({
      pluginName,
      webComponentTag,
      config,
    });
  }

  public loadJsOnRendererView(pluginName: string, path: string) {
    this.registeredLoadJsOnRendererView.push({ pluginName, path });
  }

  public loadCssOnRendererView(pluginName: string, path: string) {
    this.registeredLoadCssOnRendererView.push({ pluginName, path });
  }

  public registerRendererViewWebComponent(
    pluginName: string,
    webComponentTag: string,
  ) {
    this.registeredRendererViewWebComponent.push({
      pluginName,
      webComponentTag,
    });
  }

  public registerSceneCreator(
    pluginName: string,
    meta: {
      title: string;
      description: string;
      categories: SceneCategories[];
      isExperimental?: boolean;
      isStarred?: boolean;
    },
  ) {
    this.registeredSceneCreator.push({
      pluginName,
      sceneCreatorMeta: meta,
    });
  }

  public registerPrivateRoute(
    pluginName: string,
    path: string,
    middleware: RequestHandler,
  ) {
    this.registeredPrivateRoute.push({ pluginName, path, middleware });
  }

  public registerKeyPressHandler(
    pluginName: string,
    callback: RegisterKeyPressHandlerCallback<PluginDataType, RendererDataType>,
  ) {
    this.registeredKeyPressHandler.push({ pluginName, callback });
  }

  public registerCSPDirective(pluginName: string, cspDirective: any) {
    this.registeredCSPDirectives.push({ pluginName, cspDirective });
  }

  public registerEnvToViews(
    pluginName: string,
    envVars: Record<string, string>,
  ) {
    this.registeredEnvToViews.push({ pluginName, envVars });
  }

  public async uploadMedia(
    data: string | Buffer,
    fileExtension: string,
    { organizationId, userId }: { organizationId: string; userId: string },
  ) {
    const fileSize =
      typeof data === "object" && "byteLength" in data
        ? data.byteLength
        : data.length;

    const { mediaId, fileName } = await new media[
      process.env.STORAGE_TYPE as "file" | "s3"
    ].mediaHandler(this.app).uploadMedia({
      file: stream.Readable.from(data),
      fileExtension,
      fileSize,
      userId,
      organizationId,
    });

    return {
      mediaId,
      fileExtension,
      fileName,
      url: process.env.ROOT_URL + "/media/data/" + fileName,
    };
  }

  public async deleteMedia(fullFileId: string) {
    try {
      await new media[process.env.STORAGE_TYPE as "file" | "s3"].mediaHandler(
        this.app,
      ).deleteMedia(fullFileId);
      return { success: true };
    } catch (e) {
      return { success: false };
    }
  }
}

// Class to access the data in ServerPluginApi
export class ServerPluginApiPrivate extends ServerPluginApi {
  getRegisteredTrpcAppRouter() {
    return this.registeredTrpcAppRouter;
  }
  getRegisteredOnPluginDataCreated() {
    return this.registeredOnPluginDataCreated;
  }
  getRegisteredOnPluginDataLoaded() {
    return this.registeredOnPluginDataLoaded;
  }
  getRegisteredOnRendererDataCreated() {
    return this.registeredOnRendererDataCreated;
  }
  getRegisteredOnRendererDataLoaded() {
    return this.registeredOnRendererDataLoaded;
  }
  getRegisteredServeStatic() {
    return this.registeredServeStatic;
  }
  getRegisteredLoadJsOnRemoteView() {
    return this.registeredLoadJsOnRemoteView;
  }
  getRegisteredLoadCssOnRemoteView() {
    return this.registeredLoadCssOnRemoteView;
  }
  getRegisteredRemoteViewWebComponent() {
    return this.registeredRemoteViewWebComponent;
  }
  getRegisteredLoadJsOnRendererView() {
    return this.registeredLoadJsOnRendererView;
  }
  getRegisteredLoadCssOnRendererView() {
    return this.registeredLoadCssOnRendererView;
  }
  getRegisteredRendererViewWebComponent() {
    return this.registeredRendererViewWebComponent;
  }
  getRegisteredSceneCreator() {
    return this.registeredSceneCreator;
  }
  getRegisteredPrivateRoute() {
    return this.registeredPrivateRoute;
  }
  getRegisteredKeyPressHandler() {
    return this.registeredKeyPressHandler;
  }
  getRegisteredCSPDirectives() {
    return this.registeredCSPDirectives;
  }
  getRegisteredEnvToViews() {
    return this.registeredEnvToViews;
  }
}
