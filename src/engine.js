/**
 * Receitas em Escala — exact, local recipe calculations.
 * Copyright (c) 2026 Martin Lofrano — LOFRANO TECNOLOGIA
 * SPDX-License-Identifier: MIT
 */

const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_JSON_DEPTH = 12;
const DIMENSIONS = new Set(["mass", "volume", "count"]);
const UNIT_DIMENSION = { g: "mass", kg: "mass", ml: "volume", l: "volume", un: "count" };
const BASE_UNITS = { mass: "g", volume: "ml", count: "un" };
const MESSAGES = Object.freeze({
  INVALID_BOOK: "Os dados do caderno são inválidos.",
  INVALID_QUANTITY: "Informe uma quantidade válida.",
  INVALID_SERVINGS: "Informe um número de porções válido.",
  UNKNOWN_INGREDIENT: "O ingrediente não foi encontrado.",
  INGREDIENT_IN_USE: "O ingrediente está em uso em uma receita.",
  UNKNOWN_RECIPE: "A receita não foi encontrada.",
  UNKNOWN_PLAN: "O item do planejamento não foi encontrado.",
  INVALID_AMOUNT: "A quantidade calculada é inválida.",
  INVALID_JSON: "O arquivo JSON é inválido.",
});

export class BookError extends Error {
  constructor(code = "INVALID_BOOK") {
    const safeCode = Object.hasOwn(MESSAGES, code) ? code : "INVALID_BOOK";
    super(MESSAGES[safeCode]);
    this.name = "BookError";
    this.code = safeCode;
  }
}

function fail(code = "INVALID_BOOK") {
  throw new BookError(code);
}

// Examine every descriptor before reading any caller-owned property value.
function record(value, keys, code = "INVALID_BOOK") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(code);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actualKeys = Reflect.ownKeys(descriptors);
  if (actualKeys.length !== keys.length) fail(code);
  for (const key of actualKeys) {
    if (typeof key !== "string" || !keys.includes(key)) fail(code);
    if (!Object.hasOwn(descriptors[key], "value")) fail(code);
  }
  for (const key of keys) if (!Object.hasOwn(descriptors, key)) fail(code);
  const result = Object.create(null);
  for (const key of keys) result[key] = descriptors[key].value;
  return result;
}

function array(value, maximum) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length = descriptors.length.value;
  if (length > maximum || Reflect.ownKeys(descriptors).length !== length + 1) fail();
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[index];
    if (!descriptor || !Object.hasOwn(descriptor, "value")) fail();
  }
  const result = [];
  for (let index = 0; index < length; index += 1) result.push(descriptors[index].value);
  return result;
}

function isId(value) {
  return typeof value === "string" && value.length >= 1 && value.length <= 40 &&
    /^[A-Za-z0-9]/u.test(value) && !/[^A-Za-z0-9_-]/u.test(value);
}

function label(value, maximum) {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim() ||
      /[\p{C}\p{Zl}\p{Zp}]/u.test(value) || [...value].length > maximum) fail();
  return value;
}

function isServings(value) {
  return Number.isSafeInteger(value) && value >= 1 && value <= 1000;
}

function decimalFraction(value) {
  const [whole, decimal = ""] = value.split(".");
  return { n: BigInt(whole + decimal), d: 10n ** BigInt(decimal.length) };
}

export function normalizeQuantity(text) {
  if (typeof text !== "string") fail("INVALID_QUANTITY");
  const value = text.trim();
  const match = /^[0-9]{1,7}(?:[.,][0-9]{1,6})?$/u.exec(value);
  if (!match || match[0] !== value) fail("INVALID_QUANTITY");
  const [whole, decimal = ""] = value.replace(",", ".").split(".");
  const n = BigInt(whole + decimal);
  const d = 10n ** BigInt(decimal.length);
  if (n === 0n || n > 1000000n * d) fail("INVALID_QUANTITY");
  const canonicalWhole = BigInt(whole).toString();
  const canonicalDecimal = decimal.replace(/0+$/u, "");
  return canonicalDecimal ? `${canonicalWhole}.${canonicalDecimal}` : canonicalWhole;
}

function canonicalQuantity(value) {
  if (typeof value !== "string") fail();
  try {
    if (normalizeQuantity(value) !== value) fail();
  } catch (error) {
    if (error instanceof BookError) fail();
    throw error;
  }
  return value;
}

function ingredient(value) {
  const item = record(value, ["id", "name", "dimension"]);
  if (!isId(item.id) || !DIMENSIONS.has(item.dimension)) fail();
  return { id: item.id, name: label(item.name, 80), dimension: item.dimension };
}

function recipe(value, ingredients) {
  const item = record(value, ["id", "title", "servings", "items", "steps"]);
  if (!isId(item.id) || !isServings(item.servings)) fail();
  const title = label(item.title, 120);
  if (typeof item.steps !== "string" || [...item.steps].length > 10000 ||
      /\p{C}/u.test(item.steps.replace(/[\n\t]/gu, ""))) fail();
  const lines = array(item.items, 50);
  if (lines.length === 0) fail();
  const seen = new Set();
  const items = lines.map((line) => {
    const entry = record(line, ["ingredientId", "quantity", "unit"]);
    if (!isId(entry.ingredientId) || seen.has(entry.ingredientId)) fail();
    const known = ingredients.get(entry.ingredientId);
    if (!known || typeof entry.unit !== "string" ||
        !Object.hasOwn(UNIT_DIMENSION, entry.unit) ||
        UNIT_DIMENSION[entry.unit] !== known.dimension) fail();
    seen.add(entry.ingredientId);
    return { ingredientId: entry.ingredientId, quantity: canonicalQuantity(entry.quantity), unit: entry.unit };
  });
  return { id: item.id, title, servings: item.servings, items, steps: item.steps };
}

function planItem(value, recipes) {
  const item = record(value, ["id", "recipeId", "servings"]);
  if (!isId(item.id) || !isId(item.recipeId) || !recipes.has(item.recipeId) ||
      !isServings(item.servings)) fail();
  return { id: item.id, recipeId: item.recipeId, servings: item.servings };
}

function collection(values, maximum, convert) {
  const seen = new Set();
  return array(values, maximum).map((value) => {
    const entry = convert(value);
    if (seen.has(entry.id)) fail();
    seen.add(entry.id);
    return entry;
  });
}

function utf8Bytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

function canonicalJson(book) {
  return `${JSON.stringify(book, null, 2)}\n`;
}

export function createBook() {
  return { schemaVersion: 1, ingredients: [], recipes: [], plan: [] };
}

export function validateBook(book) {
  const source = record(book, ["schemaVersion", "ingredients", "recipes", "plan"]);
  if (source.schemaVersion !== 1) fail();
  const ingredients = collection(source.ingredients, 200, ingredient);
  const ingredientMap = new Map(ingredients.map((entry) => [entry.id, entry]));
  const recipes = collection(source.recipes, 100, (entry) => recipe(entry, ingredientMap));
  const recipeMap = new Map(recipes.map((entry) => [entry.id, entry]));
  const plan = collection(source.plan, 200, (entry) => planItem(entry, recipeMap));
  const result = { schemaVersion: 1, ingredients, recipes, plan };
  if (utf8Bytes(canonicalJson(result)) > MAX_JSON_BYTES) fail();
  return result;
}

function replaceOrAppend(values, entry) {
  const index = values.findIndex((value) => value.id === entry.id);
  if (index === -1) values.push(entry);
  else values[index] = entry;
}

export function upsertIngredient(book, value) {
  const result = validateBook(book);
  replaceOrAppend(result.ingredients, ingredient(value));
  return validateBook(result);
}

export function removeIngredient(book, id) {
  const result = validateBook(book);
  const index = result.ingredients.findIndex((entry) => entry.id === id);
  if (index === -1) fail("UNKNOWN_INGREDIENT");
  if (result.recipes.some((entry) => entry.items.some((line) => line.ingredientId === id))) {
    fail("INGREDIENT_IN_USE");
  }
  result.ingredients.splice(index, 1);
  return result;
}

export function upsertRecipe(book, value) {
  const result = validateBook(book);
  const ingredients = new Map(result.ingredients.map((entry) => [entry.id, entry]));
  replaceOrAppend(result.recipes, recipe(value, ingredients));
  return validateBook(result);
}

export function removeRecipe(book, id) {
  const result = validateBook(book);
  const index = result.recipes.findIndex((entry) => entry.id === id);
  if (index === -1) fail("UNKNOWN_RECIPE");
  result.recipes.splice(index, 1);
  result.plan = result.plan.filter((entry) => entry.recipeId !== id);
  return result;
}

export function upsertPlanItem(book, value) {
  const result = validateBook(book);
  const recipes = new Map(result.recipes.map((entry) => [entry.id, entry]));
  replaceOrAppend(result.plan, planItem(value, recipes));
  return validateBook(result);
}

export function removePlanItem(book, id) {
  const result = validateBook(book);
  const index = result.plan.findIndex((entry) => entry.id === id);
  if (index === -1) fail("UNKNOWN_PLAN");
  result.plan.splice(index, 1);
  return result;
}

function gcd(a, b) {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function fraction(n, d) {
  const divisor = gcd(n, d);
  return { n: n / divisor, d: d / divisor };
}

function publicFraction({ n, d }) {
  return { numerator: n.toString(), denominator: d.toString() };
}

function scaleLine(line, targetServings, baseServings) {
  const { n, d } = decimalFraction(line.quantity);
  const factor = line.unit === "kg" || line.unit === "l" ? 1000n : 1n;
  return fraction(n * factor * BigInt(targetServings), d * BigInt(baseServings));
}

function resultItem(known, quantity) {
  return {
    ingredientId: known.id,
    name: known.name,
    dimension: known.dimension,
    quantity: publicFraction(quantity),
    unit: BASE_UNITS[known.dimension],
  };
}

export function scaleRecipe(book, id, servings) {
  const valid = validateBook(book);
  if (!isServings(servings)) fail("INVALID_SERVINGS");
  const selected = valid.recipes.find((entry) => entry.id === id);
  if (!selected) fail("UNKNOWN_RECIPE");
  const ingredients = new Map(valid.ingredients.map((entry) => [entry.id, entry]));
  return {
    recipeId: selected.id,
    title: selected.title,
    baseServings: selected.servings,
    servings,
    items: selected.items.map((line) => resultItem(
      ingredients.get(line.ingredientId), scaleLine(line, servings, selected.servings),
    )),
    steps: selected.steps,
  };
}

function listFromValidBook(book) {
  const recipes = new Map(book.recipes.map((entry) => [entry.id, entry]));
  const totals = new Map();
  for (const planned of book.plan) {
    const selected = recipes.get(planned.recipeId);
    for (const line of selected.items) {
      const next = scaleLine(line, planned.servings, selected.servings);
      const previous = totals.get(line.ingredientId);
      totals.set(line.ingredientId, previous
        ? fraction(previous.n * next.d + next.n * previous.d, previous.d * next.d)
        : next);
    }
  }
  return book.ingredients.filter((entry) => totals.has(entry.id))
    .map((entry) => resultItem(entry, totals.get(entry.id)));
}

export function shoppingList(book) {
  return listFromValidBook(validateBook(book));
}

export function formatAmount(amount, baseUnit) {
  const parts = record(amount, ["numerator", "denominator"], "INVALID_AMOUNT");
  for (const value of [parts.numerator, parts.denominator]) {
    if (typeof value !== "string" || value.length === 0 || value.length > 2000 ||
        value[0] === "0" || /[^0-9]/u.test(value)) fail("INVALID_AMOUNT");
  }
  if (baseUnit !== "g" && baseUnit !== "ml" && baseUnit !== "un") fail("INVALID_AMOUNT");
  const numerator = BigInt(parts.numerator);
  let denominator = BigInt(parts.denominator);
  let unit = baseUnit;
  if (baseUnit !== "un" && numerator >= denominator * 1000n) {
    denominator *= 1000n;
    unit = baseUnit === "g" ? "kg" : "l";
  }
  const scaled = numerator * 1000000n;
  const remainder = scaled % denominator;
  let rounded = scaled / denominator;
  if (remainder * 2n >= denominator) rounded += 1n;
  const whole = (rounded / 1000000n).toString();
  const decimal = (rounded % 1000000n).toString().padStart(6, "0").replace(/0+$/u, "");
  return { value: decimal ? `${whole},${decimal}` : whole, unit, approximate: remainder !== 0n };
}

function csvCell(value) {
  let text = value;
  if (/^[=+\-@\t\r]/u.test(text)) text = `'${text}`;
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

export function shoppingCsv(book) {
  const list = shoppingList(book);
  const rows = ["ingredient_id,name,numerator,denominator,unit"];
  for (const item of list) {
    rows.push([item.ingredientId, item.name, item.quantity.numerator,
      item.quantity.denominator, item.unit].map(csvCell).join(","));
  }
  return `${rows.join("\n")}\n`;
}

export function serializeBook(book) {
  return canonicalJson(validateBook(book));
}

function hasUnpairedSurrogate(text) {
  for (let index = 0; index < text.length; index += 1) {
    const current = text.charCodeAt(index);
    if (current >= 0xd800 && current <= 0xdbff) {
      const following = text.charCodeAt(index + 1);
      if (!(following >= 0xdc00 && following <= 0xdfff)) return true;
      index += 1;
    } else if (current >= 0xdc00 && current <= 0xdfff) return true;
  }
  return false;
}

// A bounded parser detects duplicate decoded keys before object construction.
// Objects use null prototypes until validation produces the canonical model.
function parseJson(text) {
  let position = 0;
  function whitespace() {
    while (position < text.length && /[ \t\r\n]/u.test(text[position])) position += 1;
  }
  function string() {
    const start = position;
    position += 1;
    while (position < text.length) {
      const character = text[position];
      if (character === '"') {
        position += 1;
        let value;
        try { value = JSON.parse(text.slice(start, position)); } catch { fail("INVALID_JSON"); }
        if (hasUnpairedSurrogate(value)) fail("INVALID_JSON");
        return value;
      }
      if (character.charCodeAt(0) < 0x20) fail("INVALID_JSON");
      if (character === "\\") position += 1;
      position += 1;
    }
    fail("INVALID_JSON");
  }
  function value(depth) {
    whitespace();
    const character = text[position];
    if (character === '"') return string();
    if (character === "{" || character === "[") {
      if (depth >= MAX_JSON_DEPTH) fail("INVALID_JSON");
      const object = character === "{";
      const result = object ? Object.create(null) : [];
      const seen = object ? new Set() : null;
      const closing = object ? "}" : "]";
      position += 1;
      whitespace();
      if (text[position] === closing) { position += 1; return result; }
      while (position < text.length) {
        let key;
        if (object) {
          if (text[position] !== '"') fail("INVALID_JSON");
          key = string();
          if (seen.has(key)) fail("INVALID_JSON");
          seen.add(key);
          whitespace();
          if (text[position] !== ":") fail("INVALID_JSON");
          position += 1;
        }
        const entry = value(depth + 1);
        if (object) result[key] = entry;
        else result.push(entry);
        whitespace();
        if (text[position] === closing) { position += 1; return result; }
        if (text[position] !== ",") fail("INVALID_JSON");
        position += 1;
        whitespace();
      }
      fail("INVALID_JSON");
    }
    for (const [token, result] of [["true", true], ["false", false], ["null", null]]) {
      if (text.startsWith(token, position)) { position += token.length; return result; }
    }
    const number = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u.exec(text.slice(position));
    if (!number) fail("INVALID_JSON");
    position += number[0].length;
    return Number(number[0]);
  }
  const result = value(0);
  whitespace();
  if (position !== text.length) fail("INVALID_JSON");
  return result;
}

export function parseBook(text) {
  if (typeof text !== "string" || text.charCodeAt(0) === 0xfeff ||
      hasUnpairedSurrogate(text) || utf8Bytes(text) > MAX_JSON_BYTES) fail("INVALID_JSON");
  return validateBook(parseJson(text));
}
