/* SPDX-License-Identifier: MIT */
import test from "node:test";
import assert from "node:assert/strict";
import {
  BookError, createBook, validateBook, normalizeQuantity, upsertIngredient,
  removeIngredient, upsertRecipe, removeRecipe, upsertPlanItem, removePlanItem,
  scaleRecipe, shoppingList, formatAmount, shoppingCsv, serializeBook, parseBook,
} from "../src/engine.js";

function fixture() {
  return {
    schemaVersion: 1,
    ingredients: [
      { id: "oats", name: "Aveia", dimension: "mass" },
      { id: "other_oats", name: "Aveia", dimension: "mass" },
      { id: "water", name: "Água", dimension: "volume" },
      { id: "eggs", name: "Ovos", dimension: "count" },
    ],
    recipes: [
      {
        id: "bowl", title: "Tigela demonstrativa", servings: 3,
        items: [
          { ingredientId: "oats", quantity: "0.125", unit: "kg" },
          { ingredientId: "water", quantity: "0.2", unit: "l" },
          { ingredientId: "eggs", quantity: "2", unit: "un" },
        ],
        steps: "Misture.\n\tSirva conforme sua preferência.",
      },
      {
        id: "second", title: "Segunda preparação demonstrativa", servings: 7,
        items: [
          { ingredientId: "oats", quantity: "100", unit: "g" },
          { ingredientId: "other_oats", quantity: "0.000001", unit: "kg" },
          { ingredientId: "eggs", quantity: "3", unit: "un" },
        ],
        steps: "",
      },
    ],
    plan: [
      { id: "monday", recipeId: "bowl", servings: 2 },
      { id: "tuesday", recipeId: "second", servings: 3 },
      { id: "wednesday", recipeId: "bowl", servings: 1 },
    ],
  };
}

const copy = (value) => structuredClone(value);
function rejects(code, action) {
  assert.throws(action, (error) => error instanceof BookError && error.code === code);
}
function singleIngredient(id = "a") {
  return { id, name: "Ingrediente", dimension: "mass" };
}
function singleRecipe(id = "r") {
  return { id, title: "Receita", servings: 1, items: [{ ingredientId: "a", quantity: "1", unit: "g" }], steps: "" };
}

test("createBook starts empty and returns independent arrays", () => {
  const first = createBook();
  const second = createBook();
  assert.deepEqual(first, { schemaVersion: 1, ingredients: [], recipes: [], plan: [] });
  first.ingredients.push(singleIngredient());
  assert.deepEqual(second.ingredients, []);
});

test("normalizeQuantity accepts bounded decimals and returns canonical text", () => {
  for (const [input, expected] of [
    ["0001,500000", "1.5"], ["  0000001.000000\n", "1"],
    ["0.000001", "0.000001"], ["1000000,000000", "1000000"],
    ["0000000.010000", "0.01"], ["999999.999999", "999999.999999"],
  ]) assert.equal(normalizeQuantity(input), expected);
});

test("normalizeQuantity rejects signs, grouping, exponents, zero and excessive precision", () => {
  for (const input of [null, 1, "", "0", "0,000000", "-1", "+1", "1e3", "1/2", "1.", ".1", "1,2.3", "1 000", "1_000", "00000001", "0.0000001", "1000000.000001", "١", "1\n2"]) {
    rejects("INVALID_QUANTITY", () => normalizeQuantity(input));
  }
});

test("ingredient upsert retains position and never aliases its inputs", () => {
  const original = fixture();
  const before = copy(original);
  const input = { id: "water", name: "Água filtrada", dimension: "volume" };
  const updated = upsertIngredient(original, input);
  assert.deepEqual(updated.ingredients.map((item) => item.id), ["oats", "other_oats", "water", "eggs"]);
  assert.equal(updated.ingredients[2].name, "Água filtrada");
  input.name = "Depois";
  updated.recipes[0].items[0].quantity = "9";
  assert.deepEqual(original, before);
  assert.equal(updated.ingredients[2].name, "Água filtrada");
  assert.equal(upsertIngredient(original, { id: "salt", name: "Sal", dimension: "mass" }).ingredients.at(-1).id, "salt");
});

test("validateBook canonicalizes plain and null-prototype objects without aliases", () => {
  const input = fixture();
  Object.setPrototypeOf(input, null);
  Object.setPrototypeOf(input.ingredients[0], null);
  const validated = validateBook(input);
  assert.equal(Object.getPrototypeOf(validated), Object.prototype);
  assert.equal(Object.getPrototypeOf(validated.ingredients[0]), Object.prototype);
  validated.plan[0].servings = 999;
  validated.recipes[0].items[0].quantity = "9";
  assert.equal(input.plan[0].servings, 2);
  assert.equal(input.recipes[0].items[0].quantity, "0.125");
});

test("objects reject unknown keys, symbols, prototypes and accessors before invoking them", () => {
  let reads = 0;
  for (const mutate of [
    (b) => { b.extra = true; },
    (b) => { b[Symbol("hidden")] = 1; },
    (b) => { Object.setPrototypeOf(b, { custom: true }); },
    (b) => { Object.defineProperty(b, "ingredients", { get() { reads += 1; throw new Error("secret"); } }); },
    (b) => { Object.defineProperty(b.recipes[0].items[0], "quantity", { get() { reads += 1; return "1"; } }); },
  ]) {
    const book = fixture();
    mutate(book);
    rejects("INVALID_BOOK", () => validateBook(book));
  }
  assert.equal(reads, 0);
});

test("arrays reject holes, extras, symbols, custom prototypes and accessor elements", () => {
  let reads = 0;
  for (const mutate of [
    (a) => { delete a[0]; },
    (a) => { a.extra = 1; },
    (a) => { a[Symbol("extra")] = 1; },
    (a) => { Object.setPrototypeOf(a, null); },
    (a) => { Object.defineProperty(a, "0", { get() { reads += 1; return singleIngredient(); } }); },
  ]) {
    const book = fixture();
    mutate(book.ingredients);
    rejects("INVALID_BOOK", () => validateBook(book));
  }
  assert.equal(reads, 0);
});

test("IDs and Unicode labels enforce exact boundaries", () => {
  const book = createBook();
  assert.equal(upsertIngredient(book, { id: "a".repeat(40), name: "🥣".repeat(80), dimension: "mass" }).ingredients.length, 1);
  for (const id of ["", "a".repeat(41), "_a", "a b", "á", "a\n", "__proto__"]) {
    rejects("INVALID_BOOK", () => upsertIngredient(book, { id, name: "A", dimension: "mass" }));
  }
  for (const name of ["", " a", "a ", "a\n", "a\t", "a\u200b", "a\u2028", "a\u2029", "a\ue000", "🥣".repeat(81)]) {
    rejects("INVALID_BOOK", () => upsertIngredient(book, { id: "a", name, dimension: "mass" }));
  }
});

test("recipes require canonical quantities, compatible units and permitted steps", () => {
  for (const mutate of [
    (r) => { r.items[0].quantity = "01"; },
    (r) => { r.items[0].quantity = "1,5"; },
    (r) => { r.items[0].unit = "ml"; },
    (r) => { r.items[0].unit = "constructor"; },
    (r) => { r.steps = "\r"; },
    (r) => { r.steps = "\u200d"; },
    (r) => { r.steps = "x".repeat(10001); },
    (r) => { r.title = "🥣".repeat(121); },
    (r) => { r.servings = 1.5; },
  ]) {
    const book = fixture();
    mutate(book.recipes[0]);
    rejects("INVALID_BOOK", () => validateBook(book));
  }
  const book = fixture();
  book.recipes[0].steps = "🥣".repeat(10000);
  book.recipes[0].title = "🥣".repeat(120);
  assert.equal(validateBook(book).recipes[0].steps, book.recipes[0].steps);
});

test("identities are unique within collections and lines, but may repeat between collections", () => {
  const book = upsertRecipe(upsertIngredient(createBook(), singleIngredient("a")), singleRecipe("a"));
  assert.equal(upsertPlanItem(book, { id: "a", recipeId: "a", servings: 1 }).plan[0].id, "a");
  for (const collection of ["ingredients", "recipes", "plan"]) {
    const invalid = fixture();
    invalid[collection].push(copy(invalid[collection][0]));
    rejects("INVALID_BOOK", () => validateBook(invalid));
  }
  const invalid = fixture();
  invalid.recipes[0].items.push(copy(invalid.recipes[0].items[0]));
  rejects("INVALID_BOOK", () => validateBook(invalid));
});

test("catalog and recipe limits accept boundaries and reject overflow", () => {
  const book = createBook();
  book.ingredients = Array.from({ length: 200 }, (_, index) => singleIngredient(`i${index}`));
  book.recipes = Array.from({ length: 100 }, (_, index) => ({ ...singleRecipe(`r${index}`), items: [{ ingredientId: "i0", quantity: "1", unit: "g" }] }));
  assert.equal(validateBook(book).recipes.length, 100);
  rejects("INVALID_BOOK", () => upsertIngredient(book, singleIngredient("overflow")));
  rejects("INVALID_BOOK", () => upsertRecipe(book, { ...singleRecipe("overflow"), items: [{ ingredientId: "i0", quantity: "1", unit: "g" }] }));
});

test("recipe line and plan limits accept boundaries and reject overflow", () => {
  const book = createBook();
  book.ingredients = Array.from({ length: 51 }, (_, index) => singleIngredient(`i${index}`));
  book.recipes = [{ ...singleRecipe(), items: book.ingredients.slice(0, 50).map((item) => ({ ingredientId: item.id, quantity: "1", unit: "g" })) }];
  book.plan = Array.from({ length: 200 }, (_, index) => ({ id: `p${index}`, recipeId: "r", servings: 1 }));
  assert.equal(validateBook(book).plan.length, 200);
  rejects("INVALID_BOOK", () => upsertPlanItem(book, { id: "overflow", recipeId: "r", servings: 1 }));
  book.recipes[0].items.push({ ingredientId: "i50", quantity: "1", unit: "g" });
  rejects("INVALID_BOOK", () => validateBook(book));
  book.recipes[0].items = [];
  rejects("INVALID_BOOK", () => validateBook(book));
});

test("unknown references and invalid serving types fail validation", () => {
  const book = fixture();
  for (const servings of [0, 1001, "1", NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1n]) {
    rejects("INVALID_BOOK", () => upsertPlanItem(book, { id: "new", recipeId: "bowl", servings }));
  }
  rejects("INVALID_BOOK", () => upsertPlanItem(book, { id: "new", recipeId: "absent", servings: 1 }));
  const recipe = singleRecipe();
  rejects("INVALID_BOOK", () => upsertRecipe(book, recipe));
});

test("dimension edits are atomic and cannot implicitly convert a recipe", () => {
  const book = fixture();
  const before = copy(book);
  rejects("INVALID_BOOK", () => upsertIngredient(book, { id: "oats", name: "Aveia", dimension: "volume" }));
  assert.deepEqual(book, before);
});

test("ingredient removal protects references and reports unknown IDs", () => {
  const book = fixture();
  rejects("INGREDIENT_IN_USE", () => removeIngredient(book, "oats"));
  rejects("UNKNOWN_INGREDIENT", () => removeIngredient(book, "missing"));
  const extra = upsertIngredient(book, { id: "salt", name: "Sal", dimension: "mass" });
  const removed = removeIngredient(extra, "salt");
  assert.equal(removed.ingredients.length, 4);
  removed.recipes[0].items[0].quantity = "9";
  assert.equal(extra.recipes[0].items[0].quantity, "0.125");
});

test("recipe removal cascades only its plan lines and preserves the catalog", () => {
  const book = fixture();
  const removed = removeRecipe(book, "bowl");
  assert.deepEqual(removed.plan.map((item) => item.id), ["tuesday"]);
  assert.deepEqual(removed.recipes.map((item) => item.id), ["second"]);
  assert.deepEqual(removed.ingredients, book.ingredients);
  assert.equal(book.plan.length, 3);
  rejects("UNKNOWN_RECIPE", () => removeRecipe(book, "missing"));
});

test("recipe and plan upserts replace in place and clone nested entities", () => {
  const book = fixture();
  const recipe = copy(book.recipes[0]);
  recipe.title = "Novo título";
  const updated = upsertRecipe(book, recipe);
  recipe.items[0].quantity = "9";
  assert.equal(updated.recipes[0].title, "Novo título");
  assert.equal(updated.recipes[0].items[0].quantity, "0.125");
  const plan = upsertPlanItem(book, { id: "tuesday", recipeId: "bowl", servings: 7 });
  assert.deepEqual(plan.plan.map((entry) => entry.id), ["monday", "tuesday", "wednesday"]);
  assert.equal(plan.plan[1].servings, 7);
  assert.equal(removePlanItem(book, "tuesday").plan.length, 2);
  rejects("UNKNOWN_PLAN", () => removePlanItem(book, "missing"));
  assert.equal(book.plan[1].servings, 3);
});

test("scaleRecipe distinguishes missing recipe and invalid target servings", () => {
  const book = fixture();
  for (const value of [0, 1001, "3", 0.5, NaN, Infinity, null, 1n]) {
    rejects("INVALID_SERVINGS", () => scaleRecipe(book, "bowl", value));
  }
  rejects("UNKNOWN_RECIPE", () => scaleRecipe(book, "absent", 3));
});

test("scaleRecipe computes independent exact fractions and base units", () => {
  const scaled = scaleRecipe(fixture(), "bowl", 7);
  assert.deepEqual(scaled, {
    recipeId: "bowl", title: "Tigela demonstrativa", baseServings: 3, servings: 7,
    items: [
      { ingredientId: "oats", name: "Aveia", dimension: "mass", quantity: { numerator: "875", denominator: "3" }, unit: "g" },
      { ingredientId: "water", name: "Água", dimension: "volume", quantity: { numerator: "1400", denominator: "3" }, unit: "ml" },
      { ingredientId: "eggs", name: "Ovos", dimension: "count", quantity: { numerator: "14", denominator: "3" }, unit: "un" },
    ],
    steps: "Misture.\n\tSirva conforme sua preferência.",
  });
});

test("scaling preserves the smallest input and the largest factor exactly", () => {
  const book = fixture();
  book.recipes[0].servings = 1000;
  book.recipes[0].items[0].quantity = "0.000001";
  book.recipes[0].items[0].unit = "g";
  assert.deepEqual(scaleRecipe(book, "bowl", 1).items[0].quantity, { numerator: "1", denominator: "1000000000" });
  book.recipes[0].servings = 1;
  book.recipes[0].items[0].quantity = "1000000";
  book.recipes[0].items[0].unit = "kg";
  assert.deepEqual(scaleRecipe(book, "bowl", 1000).items[0].quantity, { numerator: "1000000000000", denominator: "1" });
});

test("shoppingList sums different yields, repeated plans and distinct equal names in catalog order", () => {
  assert.deepEqual(shoppingList(fixture()), [
    { ingredientId: "oats", name: "Aveia", dimension: "mass", quantity: { numerator: "1175", denominator: "7" }, unit: "g" },
    { ingredientId: "other_oats", name: "Aveia", dimension: "mass", quantity: { numerator: "3", denominator: "7000" }, unit: "g" },
    { ingredientId: "water", name: "Água", dimension: "volume", quantity: { numerator: "200", denominator: "1" }, unit: "ml" },
    { ingredientId: "eggs", name: "Ovos", dimension: "count", quantity: { numerator: "23", denominator: "7" }, unit: "un" },
  ]);
  assert.deepEqual(shoppingList(createBook()), []);
  const book = fixture();
  book.plan = [];
  assert.deepEqual(shoppingList(book), []);
});

test("derived and mutation outputs share no mutable substructures with previous results", () => {
  const book = fixture();
  const before = copy(book);
  const scaled = scaleRecipe(book, "bowl", 1);
  const list = shoppingList(book);
  scaled.items[0].quantity.numerator = "99";
  list[0].quantity.denominator = "99";
  const a = removePlanItem(book, "monday");
  const b = removePlanItem(book, "monday");
  a.recipes[0].items[0].quantity = "999";
  assert.equal(b.recipes[0].items[0].quantity, "0.125");
  assert.deepEqual(book, before);
});

test("formatAmount chooses units using the exact amount", () => {
  for (const [n, d, base, expected] of [
    ["1500", "1", "g", { value: "1,5", unit: "kg", approximate: false }],
    ["2000000", "2000", "ml", { value: "1", unit: "l", approximate: false }],
    ["1500", "1", "un", { value: "1500", unit: "un", approximate: false }],
    ["9999999999", "10000000", "g", { value: "1000", unit: "g", approximate: true }],
  ]) assert.deepEqual(formatAmount({ numerator: n, denominator: d }, base), expected);
});

test("formatAmount rounds half up, trims zeros and signals approximation before rounding", () => {
  for (const [n, d, value, approximate] of [
    ["1", "3", "0,333333", true], ["2", "3", "0,666667", true],
    ["1", "2000000", "0,000001", true], ["1", "4000000", "0", true],
    ["1", "1000000", "0,000001", false], ["125", "1000", "0,125", false],
    ["2", "6", "0,333333", true], ["9999995", "10000000", "1", true],
  ]) assert.deepEqual(formatAmount({ numerator: n, denominator: d }, "un"), { value, unit: "un", approximate });
  assert.equal(formatAmount({ numerator: "9".repeat(2000), denominator: "1" }, "un").value, "9".repeat(2000));
});

test("formatAmount strictly validates amount objects, units and integer strings", () => {
  for (const amount of [null, [], { numerator: "1", denominator: "1", extra: 0 },
    { numerator: "0", denominator: "1" }, { numerator: "01", denominator: "1" },
    { numerator: "1\n", denominator: "1" }, { numerator: "1", denominator: "0" },
    { numerator: 1, denominator: "1" }, { numerator: "1", denominator: "9".repeat(2001) },
  ]) rejects("INVALID_AMOUNT", () => formatAmount(amount, "g"));
  rejects("INVALID_AMOUNT", () => formatAmount({ numerator: "1", denominator: "1" }, "kg"));
  let read = false;
  const amount = { numerator: "1", get denominator() { read = true; return "1"; } };
  rejects("INVALID_AMOUNT", () => formatAmount(amount, "g"));
  assert.equal(read, false);
});

test("CSV keeps exact base fractions, quotes RFC4180 cells and prefixes formula starters", () => {
  const book = fixture();
  book.ingredients[0].name = '=SOMA("a,b")';
  book.ingredients[1].name = "+Outra";
  book.ingredients[2].name = "-Água";
  book.ingredients[3].name = "@Ovos";
  assert.equal(shoppingCsv(book),
    'ingredient_id,name,numerator,denominator,unit\noats,"\'=SOMA(""a,b"")",1175,7,g\nother_oats,\'+Outra,3,7000,g\nwater,\'-Água,200,1,ml\neggs,\'@Ovos,23,7,un\n');
  assert.equal(shoppingCsv(createBook()), "ingredient_id,name,numerator,denominator,unit\n");
});

test("serialization is canonical, readable Unicode with one final LF and round-trips", () => {
  const book = fixture();
  const text = serializeBook(book);
  assert.ok(text.startsWith('{\n  "schemaVersion": 1,\n'));
  assert.ok(text.includes("Água"));
  assert.ok(text.endsWith("}\n"));
  assert.ok(!text.endsWith("\n\n"));
  assert.deepEqual(parseBook(text), book);
  assert.equal(serializeBook(parseBook(text)), text);
});

test("parseBook separates malformed transport and syntax from invalid models", () => {
  for (const value of [null, 1, "", "\ufeff{}", "{} trailing", "{", "[1,]", '{"a":01}', '{"a":NaN}', '{"a":"\n"}', " ".repeat(8 * 1024 * 1024 + 1)]) {
    rejects("INVALID_JSON", () => parseBook(value));
  }
  for (const value of ["null", "[]", "{}", '{"schemaVersion":1e999,"ingredients":[],"recipes":[],"plan":[]}']) {
    rejects("INVALID_BOOK", () => parseBook(value));
  }
});

test("parseBook rejects duplicate decoded keys at every depth", () => {
  for (const text of [
    '{"schemaVersion":1,"schemaVersion":1,"ingredients":[],"recipes":[],"plan":[]}',
    '{"a":1,"\\u0061":2}', '{"unknown":[{"nested":1,"\\u006eested":2}]}',
    '{"__proto__":1,"\\u005f_proto__":2}',
  ]) rejects("INVALID_JSON", () => parseBook(text));
});

test("JSON container depth twelve is parsed and depth thirteen is rejected", () => {
  rejects("INVALID_BOOK", () => parseBook("[".repeat(12) + "0" + "]".repeat(12)));
  rejects("INVALID_JSON", () => parseBook("[".repeat(13) + "0" + "]".repeat(13)));
  rejects("INVALID_JSON", () => parseBook('{"x":'.repeat(13) + "0" + "}".repeat(13)));
});

test("JSON forbids raw and decoded isolated surrogates while permitting valid pairs", () => {
  for (const text of ['"\ud800"', '"\udc00"', '"\\ud800"', '"\\udc00"', '{"\\ud800":1}']) {
    rejects("INVALID_JSON", () => parseBook(text));
  }
  const book = createBook();
  book.ingredients = [{ id: "bowl", name: "🥣", dimension: "count" }];
  assert.deepEqual(parseBook(serializeBook(book).replace("🥣", "\\ud83e\\udd63")), book);
});

test("prototype-related JSON keys are rejected without pollution", () => {
  const before = Object.getOwnPropertyNames(Object.prototype);
  rejects("INVALID_BOOK", () => parseBook('{"schemaVersion":1,"ingredients":[],"recipes":[],"plan":[],"__proto__":{"polluted":true}}'));
  assert.equal({}.polluted, undefined);
  assert.deepEqual(Object.getOwnPropertyNames(Object.prototype), before);
});

test("all book-taking APIs reject an invalid book before deriving or mutating", () => {
  const invalid = fixture();
  invalid.plan[0].recipeId = "missing";
  for (const action of [
    () => validateBook(invalid), () => upsertIngredient(invalid, singleIngredient()),
    () => removeIngredient(invalid, "missing"), () => upsertRecipe(invalid, singleRecipe()),
    () => removeRecipe(invalid, "missing"), () => upsertPlanItem(invalid, {}),
    () => removePlanItem(invalid, "missing"), () => scaleRecipe(invalid, "missing", 0),
    () => shoppingList(invalid), () => shoppingCsv(invalid), () => serializeBook(invalid),
  ]) rejects("INVALID_BOOK", action);
});

test("errors have stable generic Portuguese messages without rejected input", () => {
  const secret = "PRIVATE_CONTENT_DO_NOT_ECHO";
  for (const action of [() => normalizeQuantity(secret), () => parseBook(secret), () => removeRecipe(createBook(), secret)]) {
    try { action(); assert.fail("Expected rejection"); }
    catch (error) {
      assert.ok(error instanceof BookError);
      assert.equal(error.name, "BookError");
      assert.ok(!error.message.includes(secret));
      assert.equal(error.message, new BookError(error.code).message);
    }
  }
});
