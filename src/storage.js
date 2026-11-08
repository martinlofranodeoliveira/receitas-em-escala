import { createBook, parseBook, serializeBook } from "./engine.js";

export const STORAGE_KEY = "lofrano.receitas.v1";
export const LOCK_NAME = "lofrano.receitas.v1.editor";

export class StorageError extends Error {
  constructor(code) {
    super(
      {
        CONFLICT: "O armazenamento foi alterado em outra aba.",
        UNAVAILABLE: "O armazenamento local não está disponível.",
        QUOTA: "Não foi possível salvar no armazenamento local.",
      }[code],
    );
    this.name = "StorageError";
    this.code = code;
  }
}

export function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readStorage(storage = browserStorage()) {
  let raw;
  try {
    if (!storage) throw new Error();
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { book: createBook(), raw: null, status: "unavailable" };
  }
  if (raw === null) return { book: createBook(), raw, status: "ready" };
  try {
    return { book: parseBook(raw), raw, status: "ready" };
  } catch {
    return { book: createBook(), raw, status: "corrupt" };
  }
}

function guard(storage, expectedRaw) {
  let actual;
  try {
    if (!storage) throw new Error();
    actual = storage.getItem(STORAGE_KEY);
  } catch {
    throw new StorageError("UNAVAILABLE");
  }
  if (actual !== expectedRaw) throw new StorageError("CONFLICT");
}

export function writeStorage(book, expectedRaw, storage = browserStorage()) {
  const raw = serializeBook(book);
  guard(storage, expectedRaw);
  try {
    storage.setItem(STORAGE_KEY, raw);
  } catch {
    throw new StorageError("QUOTA");
  }
  return raw;
}

export function clearStorage(expectedRaw, storage = browserStorage()) {
  guard(storage, expectedRaw);
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    throw new StorageError("UNAVAILABLE");
  }
}
