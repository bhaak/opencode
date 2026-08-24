# Handoff: Automatisches Neuladen extern geänderter Dateien

## Ziel

OpenCode soll erkennen, wenn Dateien während einer Session extern geändert wurden, und sie automatisch oder auf Nachfrage neu laden, bevor das nächste Tool sie verwendet.

## Implementierter Ansatz (Built-in Feature)

Direkt in opencode integriert, kein Plugin nötig.

### Architektur

Ein neuer **`SessionFileWatch`**-Service (`packages/core/src/session/file-watch.ts`) bietet:

- **`track(paths)`** – Registriert Dateien als von der Session referenziert
- **`consumeStale`** – Liefert seit dem letzten Check extern geänderte Dateien zurück

### Komponenten

#### 1. `SessionFileWatch` Service (NEU)
- Location-scoped Service, abonniert `FileSystem.Event.Changed` über den Bus
- Filtert Events auf die aktuelle Location
- Markiert getrackte Dateien als "dirty" bei externen Änderungen
- `consumeStale` gibt dirty Dateien zurück und setzt den Flag zurück

#### 2. Tool-Integration (Read, Write, Edit)
- **Read-Tool** (`packages/core/src/tool/plugin/read.ts`): Trackt gelesene Dateien
- **Write-Tool** (`packages/core/src/tool/plugin/write.ts`): Trackt geschriebene Dateien
- **Edit-Tool** (`packages/core/src/tool/plugin/edit.ts`): Trackt editierte Dateien
- Verwenden `Effect.serviceOption()` für optionalen Service (graceful degradation)

#### 3. Session Runner Integration
- In `packages/core/src/session/runner/llm.ts`:
  - Nach jedem vollständigen Step prüft `runSteps` auf stale Dateien
  - Bei externen Änderungen: `SessionEvent.Synthetic` Notification ans Modell
  - Notification-Text: `"The following file was externally modified. Reload them with the read tool if needed:\n- <path>"`
  - Prüfung nur zwischen Steps (nicht bei Retry/Continue)

### Registrierung
- `SessionFileWatch.node` in `packages/core/src/location-services.ts` registriert
- Als Dependency im Runner-Node (`SessionRunnerLLM.node`) eingetragen

### Dateien (aktuell)

| Datei | Zweck |
|---|---|
| `packages/core/src/session/file-watch.ts` | **NEU**: File-Watch-Service |
| `packages/core/src/tool/plugin/read.ts` | Trackt gelesene Dateien |
| `packages/core/src/tool/plugin/write.ts` | Trackt geschriebene Dateien |
| `packages/core/src/tool/plugin/edit.ts` | Trackt editierte Dateien |
| `packages/core/src/session/runner/llm.ts` | Stale-Check zwischen Steps |
| `packages/core/src/location-services.ts` | Service-Registrierung |

### Bekannte Einschränkungen

1. **Nur Datei-Ebene**: Das Tracking erfolgt auf absoluten Pfaden, nicht auf Verzeichnisebene
2. **Nur nach Steps**: Die Prüfung läuft nur zwischen vollständigen Steps, nicht während eines laufenden Steps
3. **Kein Auto-Reload**: Das Modell wird nur benachrichtigt, die Datei muss sich selbst neu laden
4. **Kein UI-Feedback**: Es gibt noch keine direkte UI-Anzeige für neu geladene Dateien
5. **File Watcher**: Der `@parcel/watcher`-basierte Watcher läuft bereits in `location-watcher.ts` für VCS-HEAD-Änderungen; der `SessionFileWatch` nutzt den Bus für `FileSystem.Event.Changed`

### Mögliche Erweiterungen

1. **Auto-Reload**: Statt Notification könnte ein `read`-Tool automatisch ausgeführt werden
2. **Verzeichnis-Watching**: Komplette Verzeichnisse statt einzelner Dateien tracken
3. **UI-Integration**: Anzeige im TUI, wenn Dateien neu geladen wurden
4. **File Watcher Aktivierung**: Den Watcher standardmäßig für alle Projekte aktivieren (aktuell nur für VCS)
