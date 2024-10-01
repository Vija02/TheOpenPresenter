import { initTRPC } from "@trpc/server";
import { RequestHandler } from "express";
import fs from "fs";
import path from "path";
import { typeidUnboxed } from "typeid-js";

import {
  RegisterKeyPressHandlerCallback,
  RegisterOnPluginDataCreated,
  RegisterOnPluginDataLoaded,
  RegisterOnRendererDataCreated,
  RegisterOnRendererDataLoaded,
  RemoteViewWebComponentConfig,
} from "./serverPluginTypes";

export class ServerPluginApi<PluginDataType = any, RendererDataType = any> {
  protected registeredTrpcAppRouter: ((
    t: ReturnType<typeof initTRPC.create>,
  ) => any)[] = [];
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
    sceneCreatorMeta: { title: string };
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

  public registerTrpcAppRouter(
    getAppRouter: (t: ReturnType<typeof initTRPC.create>) => any,
  ) {
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

  public registerSceneCreator(pluginName: string, meta: { title: string }) {
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

  public uploadMedia(
    media: string | NodeJS.ArrayBufferView,
    extension: string,
  ) {
    const newFileName = typeidUnboxed("media") + "." + extension;

    const uploadsDir = path.resolve(`${__dirname}/../../../../uploads`);
    const final = uploadsDir + "/" + newFileName;

    fs.writeFileSync(final, media);

    return {
      newFileName,
      url: process.env.ROOT_URL + "/media/data/" + newFileName,
      extension,
    };
  }
}
