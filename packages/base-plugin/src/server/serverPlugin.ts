import { media } from "@repo/backend-shared";
import { mediaIdFromUUID } from "@repo/lib";
import { Express, RequestHandler } from "express";
import { Pool } from "pg";
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
    {
      organizationId,
      userId,
      parentMediaIdOrUUID,
      attachTo,
    }: {
      organizationId: string;
      userId: string;
      parentMediaIdOrUUID?: string;
      attachTo?: { projectId: string; pluginId: string };
    },
  ) {
    const fileSize =
      typeof data === "object" && "byteLength" in data
        ? data.byteLength
        : data.length;

    const mediaHandler = new media[
      process.env.STORAGE_TYPE as "file" | "s3"
    ].mediaHandler(this.app.get("rootPgPool"));

    const { mediaId, fileName } = await mediaHandler.uploadMedia({
      file: stream.Readable.from(data),
      fileExtension,
      fileSize,
      userId,
      organizationId,
      isUserUploaded: false,
    });

    if (attachTo) {
      await mediaHandler.attachToProject(
        mediaId,
        attachTo.projectId,
        attachTo.pluginId,
      );
    }

    if (parentMediaIdOrUUID) {
      await mediaHandler.createDependency(parentMediaIdOrUUID, mediaId);
    }

    return {
      mediaId,
      fileExtension,
      fileName,
      url: process.env.ROOT_URL + "/media/data/" + fileName,
    };
  }

  public async deleteMedia(fullFileId: string) {
    try {
      // TODO: Permission?
      await new media[process.env.STORAGE_TYPE as "file" | "s3"].mediaHandler(
        this.app.get("rootPgPool"),
      ).deleteMedia(fullFileId);
      return { success: true };
    } catch (e) {
      return { success: false };
    }
  }

  public media = {
    getMedia: async (mediaName: string) => {
      return await new media[
        process.env.STORAGE_TYPE as "file" | "s3"
      ].mediaHandler(this.app.get("rootPgPool")).store.getReadable(mediaName);
    },
    queueVideoTranscode: async (mediaUUID: string) => {
      const pool = this.app.get("rootPgPool") as Pool;
      await pool.query(
        `
        select graphile_worker.add_job(
          'medias__transcodeVideoToHLS',
          payload := $1::json,
          queue_name := $2
        );  
      `,
        [JSON.stringify({ id: mediaUUID }), `video_transcode_${mediaUUID}`],
      );
    },
    getVideoMetadata: async (mediaUUID: string) => {
      const pool = this.app.get("rootPgPool") as Pool;
      const {
        rows: [row],
      } = await pool.query(
        `
        select * from app_public.media_video_metadata where video_media_id = $1
      `,
        [mediaUUID],
      );
      return row
        ? {
            videoMediaId: row.video_media_id as string,
            hlsMediaId: row.hls_media_id as string,
            thumbnailMediaId: row.thumbnail_media_id as string,
            // Debt: What if we change the file extension?
            hlsMediaName: mediaIdFromUUID(row.hls_media_id as string) + ".m3u8",
            thumbnailMediaName:
              mediaIdFromUUID(row.thumbnail_media_id as string) + ".jpg",
            duration: row.duration as number,
          }
        : undefined;
    },
  };
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
