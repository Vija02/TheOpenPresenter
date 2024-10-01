import _ from "lodash";
import { useRef, useSyncExternalStore } from "react";
import { AbstractType, YEvent, Map as YMap } from "yjs";

import { createTraverser } from "../YjsTraverser";
import { IDisposable } from "../yjsTypes";
import { getYjsEventPath } from "./getYjsEventPath";
import { pathTraverser } from "./pathTraverser";
import { getPathsFromSharedType, isYjsObj } from "./util";

export type YjsWatcherOptions = {
  shallow?: boolean;
};

export class YjsWatcher implements IDisposable {
  private _watcher: Record<string, { id: string; callback: () => void }[]> = {};
  private _disposable: IDisposable[] = [];

  private yjsObj: YMap<any>;
  private traverser: ReturnType<typeof createTraverser>;
  private basePath: string[];

  constructor(yjsObj: YMap<any>, options?: YjsWatcherOptions) {
    if (!(yjsObj instanceof AbstractType)) {
      throw new Error(
        "Error: Invalid value passed to watcher. YjsWatcher only accepts valid yjs object.",
      );
    }
    this.yjsObj = yjsObj;
    this.traverser = createTraverser(yjsObj);
    this.basePath = getPathsFromSharedType(yjsObj);

    if (options?.shallow) {
      const handler = this.createObserveEventHandler();
      yjsObj.observe(handler);
      this._disposable.push({
        dispose: () => yjsObj.unobserve(handler),
      });
    } else {
      const handler = this.createDeepObserveEventHandler();
      yjsObj.observeDeep(handler);
      this._disposable.push({
        dispose: () => yjsObj.unobserveDeep(handler),
      });
    }
  }

  /**
   * This functions adds a callback function to the _watcher object.
   * This callback should be called whenever the data changes to trigger an update in react
   */
  public watchYjs<Y>(traverserFn?: (x: any) => Y, callback?: () => void) {
    const paths = pathTraverser(traverserFn).map((x) =>
      this.basePath.concat(x).join("__"),
    );

    // We need this so that we can remove the watcher when unmounted
    const calledId = Math.random().toString();

    paths.forEach((path) => {
      if (!this._watcher[path]) this._watcher[path] = [];
      this._watcher[path]!.push({
        id: calledId,
        callback: callback ?? (() => {}),
      });
    });

    // Function to clean up watcher
    const dispose = () => {
      paths.forEach((path) => {
        const index =
          this._watcher[path]?.findIndex((x) => x.id === calledId) ?? -1;
        if (index !== -1) this._watcher[path]?.splice(index, 1);
      });
    };

    this._disposable.push({ dispose });

    return dispose;
  }

  public useYjs<Y>(traverserFn?: (x: any) => Y) {
    const prevDataRef = useRef<any | null>(null);

    return useSyncExternalStore(
      (callback) => {
        const cleanupWatcher = this.watchYjs(traverserFn, callback);
        return cleanupWatcher;
      },
      () => {
        const data = this.traverser(traverserFn);

        if (isYjsObj(data)) {
          if (_.isEqual(prevDataRef.current, data)) {
            return prevDataRef.current;
          } else {
            prevDataRef.current = data;
            return prevDataRef.current;
          }
        } else {
          // If it's a primitive, we just return the data directly
          return data as Y;
        }
      },
      () => {
        const data = this.traverser(traverserFn) as any;
        return data;
      },
    );
  }

  public useYjsData<Y>(traverserFn?: (x: any) => Y) {
    const prevDataRef = useRef<any | null>(null);

    return useSyncExternalStore(
      (callback) => {
        const cleanupWatcher = this.watchYjs(traverserFn, callback);
        return cleanupWatcher;
      },
      () => {
        const data = this.traverser(traverserFn);

        if (isYjsObj(data)) {
          const jsonData = (data as unknown as AbstractType<any>).toJSON();
          if (_.isEqual(prevDataRef.current, jsonData)) {
            return prevDataRef.current;
          } else {
            prevDataRef.current = jsonData;
            return prevDataRef.current;
          }
        } else {
          // If it's a primitive, we just return the data directly
          return data as Y;
        }
      },
      () => {
        const data = this.traverser(traverserFn) as any;

        if (isYjsObj(data)) {
          return data.toJson();
        }
        return data;
      },
    );
  }

  public dispose() {
    this._disposable.forEach((x) => {
      x.dispose?.();
    });
  }

  /**
   * This function creates an event handler that will listen to events from YJS.
   * And then, it will call the corresponding callback function registered in _watcher.
   * To listen to the changes, we just need to add the callback to that function.
   * For example, through the useYjsData function above
   *
   * Any paths that starts with another need to be refreshed.
   * Eg: If a__b__c is updated.
   * Then we need to refresh a__b__c__d watcher
   *
   * Same goes the other way:
   * If a__b__c is updated,
   * Then we need to refresh a__b watcher
   *
   * So both watcher and update should be as small as possible.
   * Since this will only save performance when the update and watcher is in a separate branch.
   * Eg: a__b__x and a__c
   */
  private createDeepObserveEventHandler() {
    return (events: YEvent<any>[]) => {
      events.forEach(this.eventHandler.bind(this));
    };
  }
  private createObserveEventHandler() {
    return this.eventHandler.bind(this);
  }
  private eventHandler(event: YEvent<any>) {
    const eventPaths = getYjsEventPath(event);
    const fullPaths = eventPaths.map((path) =>
      this.basePath.concat(path).join("__"),
    );

    const matched = fullPaths
      .map((fullPath) => {
        const matchingWatchers = Object.entries(this._watcher).filter(
          ([key]) => fullPath.startsWith(key) || key.startsWith(fullPath),
        );

        return matchingWatchers;
      })
      .flat();

    const withoutDuplicate = matched.reduce(
      (acc, val) => (!acc.find((x) => x[0] === val[0]) ? [...acc, val] : acc),
      [] as typeof matched,
    ) as typeof matched;

    withoutDuplicate.forEach(([_key, val]) => val.forEach((x) => x.callback()));
  }
}
