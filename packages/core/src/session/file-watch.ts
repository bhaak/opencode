export * as SessionFileWatch from "./file-watch.js"

import { Context, Effect, Layer, PubSub, Stream } from "effect"
import { makeLocationNode } from "@opencode-ai/util/effect/app-node"
import { Bus } from "../bus.js"
import { FileSystem } from "@opencode-ai/schema/filesystem"
import { Location } from "../location.js"

export interface Interface {
  /**
   * Registers one or more files as referenced by the current session.
   * Subsequent external changes to these files are tracked and,
   * when the runner checks, reported as stale.
   */
  readonly track: (paths: readonly string[]) => Effect.Effect<void>
  /**
   * Returns the set of tracked file paths that have changed externally
   * since the last `consumeStale` call, and resets the dirty flag for
   * each returned path so repeated calls report only new changes.
   */
  readonly consumeStale: Effect.Effect<readonly string[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SessionFileWatch") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const bus = yield* Bus.Service
    const location = yield* Location.Service

    // Tracked files: absolute path → whether an external change was detected
    const watched = new Map<string, boolean>()

    // Subscribe to file system change events and mark tracked files as dirty
    const subscription = yield* Effect.acquireRelease(
      Effect.gen(function* () {
        const db = yield* PubSub.unbounded<{ readonly file: string; readonly event: "add" | "change" | "unlink" }>()
        yield* Stream.runForEach(bus.subscribe(FileSystem.Event.Changed), (event) =>
          Effect.gen(function* () {
            // Filter to events at our location
            if (
              event.location &&
              (event.location.directory !== location.directory ||
                event.location.workspaceID !== location.workspaceID)
            )
              return
            const data = event.data as { readonly file: string; readonly event: "add" | "change" | "unlink" }
            yield* PubSub.publish(db, data)
          }),
        ).pipe(Effect.forkScoped)
        return db
      }),
      (db) => PubSub.shutdown(db),
    )

    // Process file change events
    yield* Stream.runForEach(Stream.fromPubSub(subscription), (data) =>
      Effect.sync(() => {
        if (data.event === "add" || data.event === "change") {
          const path = data.file
          if (watched.has(path)) watched.set(path, true)
        }
      }),
    ).pipe(Effect.forkScoped)

    return Service.of({
      track: (paths) =>
        Effect.sync(() => {
          for (const p of paths) {
            if (!watched.has(p)) watched.set(p, false)
          }
        }),
      consumeStale: Effect.sync(() => {
        const stale: string[] = []
        for (const [path, dirty] of watched) {
          if (dirty) {
            stale.push(path)
            watched.set(path, false)
          }
        }
        return stale
      }),
    })
  }),
)

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [Bus.node, Location.node],
})
