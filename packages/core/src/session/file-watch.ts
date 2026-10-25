export * as SessionFileWatch from "./file-watch.js"

import { makeLocationNode } from "@opencode/util/effect/app-node"
import { Context, Effect, Layer, Ref, Stream } from "effect"
import { Bus } from "../bus.js"
import { FileSystem } from "@opencode/schema/filesystem"

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
    // Absolute path → whether an external change was detected since the last consume.
    const watched = yield* Ref.make(new Map<string, boolean>())

    // The bus already restricts delivery to the ambient Location, so no extra filtering is needed.
    yield* bus.subscribe(FileSystem.Event.Changed).pipe(
      Stream.runForEach((event) =>
        Ref.update(watched, (entries) => {
          if (!entries.has(event.data.file)) return entries
          return new Map(entries).set(event.data.file, true)
        }),
      ),
      Effect.forkScoped({ startImmediately: true }),
    )

    return Service.of({
      track: (paths) =>
        Ref.update(watched, (entries) => {
          const next = new Map(entries)
          for (const path of paths) if (!next.has(path)) next.set(path, false)
          return next
        }),
      consumeStale: Ref.modify(watched, (entries) => {
        const stale = [...entries].filter(([, dirty]) => dirty).map(([path]) => path)
        if (stale.length === 0) return [stale, entries]
        const cleared = new Map(entries)
        for (const path of stale) cleared.set(path, false)
        return [stale, cleared]
      }),
    })
  }),
)

export const node = makeLocationNode({ service: Service, layer, deps: [Bus.node] })
