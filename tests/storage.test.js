import test from "node:test";
import assert from "node:assert/strict";
import { createBook, serializeBook } from "../src/engine.js";
import {
  STORAGE_KEY,
  readStorage,
  writeStorage,
  clearStorage,
} from "../src/storage.js";

function storage(initial = null) {
  let raw = initial;
  return {
    getItem(key) {
      assert.equal(key, STORAGE_KEY);
      return raw;
    },
    setItem(key, value) {
      assert.equal(key, STORAGE_KEY);
      raw = value;
    },
    removeItem(key) {
      assert.equal(key, STORAGE_KEY);
      raw = null;
    },
    raw: () => raw,
  };
}
test("empty storage is read without writing a demonstration", () => {
  const saved = storage();
  const result = readStorage(saved);
  assert.deepEqual(result.book, createBook());
  assert.equal(result.status, "ready");
  assert.equal(saved.raw(), null);
});
test("valid books persist and can be restored with an exact expectedRaw guard", () => {
  const saved = storage();
  const raw = writeStorage(createBook(), null, saved);
  assert.equal(raw, serializeBook(createBook()));
  assert.deepEqual(readStorage(saved).book, createBook());
  clearStorage(raw, saved);
  assert.equal(saved.raw(), null);
});
test("corrupt raw data stays untouched and available for recovery", () => {
  const raw = '{"schemaVersion":1,"recipes":oops';
  const saved = storage(raw);
  assert.equal(readStorage(saved).status, "corrupt");
  assert.equal(readStorage(saved).raw, raw);
  assert.equal(saved.raw(), raw);
});
test("write and remove refuse an unexpected storage value", () => {
  const saved = storage("other-tab");
  assert.throws(() => writeStorage(createBook(), null, saved), {
    code: "CONFLICT",
  });
  assert.throws(() => clearStorage(null, saved), { code: "CONFLICT" });
  assert.equal(saved.raw(), "other-tab");
});
test("unavailable storage is distinguished from a corrupt book", () => {
  const saved = {
    getItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(readStorage(saved).status, "unavailable");
  assert.throws(() => writeStorage(createBook(), null, saved), {
    code: "UNAVAILABLE",
  });
});
test("quota failure does not pretend a local save happened", () => {
  const saved = {
    getItem: () => null,
    setItem() {
      throw new Error("quota");
    },
  };
  assert.throws(() => writeStorage(createBook(), null, saved), {
    code: "QUOTA",
  });
  assert.equal(saved.getItem(), null);
});
