/**
 * Preload for the away message floating dialog.
 * Exposes only the two actions needed: set and cancel.
 */

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("awayAPI", {
  set:    (message: string) => ipcRenderer.send("away-dialog-set", message),
  cancel: ()                => ipcRenderer.send("away-dialog-cancel"),
});
