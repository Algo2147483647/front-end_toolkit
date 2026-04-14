export interface PickedJsonFile {
  file: File;
  handle: FileSystemFileHandle | null;
}

export async function openJsonFileWithAccess(): Promise<PickedJsonFile | null> {
  if (typeof window.showOpenFilePicker !== "function") {
    return null;
  }

  const handles = await window.showOpenFilePicker({
    excludeAcceptAllOption: false,
    multiple: false,
    types: [{
      accept: { "application/json": [".json"] },
      description: "JSON graph documents",
    }],
  });
  const handle = handles?.[0];
  if (!handle) {
    return null;
  }

  return { file: await handle.getFile(), handle };
}

export async function readJsonFile(file: File): Promise<unknown> {
  return JSON.parse(await file.text());
}

export function canOverwrite(fileHandle: FileSystemFileHandle | null): boolean {
  return Boolean(fileHandle && typeof fileHandle.createWritable === "function");
}

export async function requestWritablePermission(fileHandle: FileSystemFileHandle): Promise<boolean> {
  if (typeof fileHandle.queryPermission === "function") {
    const permission = await fileHandle.queryPermission({ mode: "readwrite" });
    if (permission === "granted") {
      return true;
    }
  }

  if (typeof fileHandle.requestPermission === "function") {
    const permission = await fileHandle.requestPermission({ mode: "readwrite" });
    return permission === "granted";
  }

  return true;
}

export async function writeJsonToHandle(fileHandle: FileSystemFileHandle, content: string): Promise<void> {
  if (!fileHandle.createWritable) {
    throw new Error("File overwrite is not supported in this browser.");
  }
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}
