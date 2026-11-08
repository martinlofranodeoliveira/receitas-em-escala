import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
import { createDemoBook } from "../src/demo.js";
import { createBook, serializeBook, parseBook } from "../src/engine.js";
import { STORAGE_KEY } from "../src/storage.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://example.test/",
});
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true },
  document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true },
  HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  HTMLInputElement: { value: dom.window.HTMLInputElement, configurable: true },
  Event: { value: dom.window.Event, configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true, configurable: true },
});
const { render, screen, within, fireEvent, cleanup, waitFor, act } =
  await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { default: App } = await import("../.test-build/App.js");
let user, downloads;
beforeEach(() => {
  dom.window.localStorage.clear();
  Object.defineProperty(globalThis, "localStorage", {
    value: dom.window.localStorage,
    configurable: true,
  });
  Object.defineProperty(dom.window.navigator, "locks", {
    value: undefined,
    configurable: true,
  });
  downloads = [];
  URL.createObjectURL = (blob) => {
    downloads.push(blob);
    return "blob:public-test";
  };
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function () {};
  user = userEvent.setup({ document: dom.window.document });
});
afterEach(() => cleanup());
function seed(book = createDemoBook()) {
  localStorage.setItem(STORAGE_KEY, serializeBook(book));
}
function stored() {
  return parseBook(localStorage.getItem(STORAGE_KEY));
}
function nav(name) {
  return within(
    screen.getByRole("navigation", { name: "Navegação principal" }),
  ).getByRole("button", { name, exact: true });
}
async function openPage(name) {
  await user.click(nav(name));
}
async function demo() {
  render(React.createElement(App));
  await user.click(screen.getByRole("button", { name: "Carregar exemplos" }));
}
async function change(label, value) {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, String(value));
}
async function newIngredient(name = "Farinha", dimension = "mass") {
  await openPage("Ingredientes");
  await user.click(screen.getByRole("button", { name: "Novo ingrediente" }));
  await user.type(screen.getByLabelText("Nome do ingrediente"), name);
  await user.selectOptions(screen.getByLabelText("Tipo de medida"), dimension);
  await user.click(screen.getByRole("button", { name: "Salvar ingrediente" }));
}
async function addPlan() {
  await user.click(
    screen.getByRole("button", { name: "Adicionar ao planejamento" }),
  );
}

test("first visit is empty, requires an explicit example choice and writes no storage", () => {
  render(React.createElement(App));
  assert.ok(screen.getByRole("heading", { name: /Sua próxima receita/ }));
  assert.ok(screen.getByRole("button", { name: "Carregar exemplos" }));
  assert.equal(localStorage.getItem(STORAGE_KEY), null);
});
test("explicit demonstration loads original recipes and persists the book", async () => {
  await demo();
  assert.equal(stored().recipes.length, 2);
  assert.ok(
    screen.getByRole("heading", { name: "Arroz com abobrinha", exact: true }),
  );
  assert.ok(screen.getByText(/Exemplo original demonstrativo/));
});
test("ingredient CRUD saves dimensions, edits by ID and confirms an unreferenced deletion", async () => {
  render(React.createElement(App));
  await newIngredient();
  assert.deepEqual(stored().ingredients[0], {
    id: "ing-1",
    name: "Farinha",
    dimension: "mass",
  });
  await user.click(
    screen.getByRole("button", { name: "Editar Farinha (ing-1)" }),
  );
  await change("Nome do ingrediente", "Farinha integral");
  await user.click(screen.getByRole("button", { name: "Salvar ingrediente" }));
  await user.click(
    screen.getByRole("button", { name: "Excluir Farinha integral (ing-1)" }),
  );
  assert.equal(stored().ingredients.length, 1);
  await user.click(
    screen.getByRole("button", { name: "Excluir ingrediente", exact: true }),
  );
  assert.equal(stored().ingredients.length, 0);
});
test("incompatible dimension update is rejected and keeps the ingredient draft", async () => {
  seed();
  render(React.createElement(App));
  await openPage("Ingredientes");
  await user.click(
    screen.getByRole("button", { name: "Editar Arroz (ing-1)" }),
  );
  await user.selectOptions(screen.getByLabelText("Tipo de medida"), "volume");
  await user.click(screen.getByRole("button", { name: "Salvar ingrediente" }));
  assert.equal(screen.getByLabelText("Tipo de medida").value, "volume");
  assert.equal(stored().ingredients[0].dimension, "mass");
  assert.match(screen.getByRole("alert").textContent, /Revise os campos/);
});
test("referenced ingredient deletion is protected before confirmation", async () => {
  seed();
  render(React.createElement(App));
  await openPage("Ingredientes");
  await user.click(
    screen.getByRole("button", { name: "Excluir Arroz (ing-1)" }),
  );
  assert.match(screen.getByRole("alert").textContent, /está em uma receita/);
  assert.equal(screen.queryByRole("dialog"), null);
  assert.equal(stored().ingredients.length, 6);
});
test("recipe draft survives a trip to create ingredients, normalizes decimals and renders steps as text", async () => {
  render(React.createElement(App));
  await user.click(
    screen.getByRole("button", { name: "Nova receita", exact: true }),
  );
  await user.type(screen.getByLabelText("Nome da receita"), "Receita da casa");
  await newIngredient("Farinha");
  await openPage("Receitas");
  assert.equal(
    screen.getByLabelText("Nome da receita").value,
    "Receita da casa",
  );
  await user.selectOptions(
    screen.getByLabelText("Ingrediente da linha 1"),
    "ing-1",
  );
  await user.type(
    screen.getByLabelText("Quantidade da linha 1"),
    "0001,500000",
  );
  await user.type(screen.getByLabelText("Modo de preparo"), "<b>Misturar</b>");
  await user.click(screen.getByRole("button", { name: "Salvar receita" }));
  assert.equal(stored().recipes[0].items[0].quantity, "1.5");
  assert.equal(stored().recipes[0].steps, "<b>Misturar</b>");
  assert.ok(screen.getByText("<b>Misturar</b>"));
  assert.equal(document.querySelector(".steps-text b"), null);
});
test("invalid quantity does not lose the recipe draft or alter the saved book", async () => {
  seed();
  const previous = localStorage.getItem(STORAGE_KEY);
  render(React.createElement(App));
  await user.click(screen.getByRole("button", { name: "Editar", exact: true }));
  await change("Quantidade da linha 1", "1e3");
  await user.click(screen.getByRole("button", { name: "Salvar receita" }));
  assert.equal(screen.getByLabelText("Quantidade da linha 1").value, "1e3");
  assert.equal(localStorage.getItem(STORAGE_KEY), previous);
  assert.match(
    screen.getByRole("alert").textContent,
    /quantidade maior que zero/,
  );
});
test("scale recalculates exact quantities without changing the original recipe", async () => {
  seed();
  render(React.createElement(App));
  await change("Preparar para", "3");
  const rice = screen.getByRole("row", { name: /Arroz ing-1/ });
  assert.match(rice.textContent, /225/);
  const oil = screen.getByRole("row", { name: /Azeite ing-3/ });
  assert.match(oil.textContent, /22,5/);
  assert.equal(stored().recipes[0].servings, 4);
  assert.equal(stored().recipes[0].items[0].quantity, "300");
});
test("fractional presentation marks approximation and preserves fixed ingredient identity", async () => {
  seed();
  render(React.createElement(App));
  await user.click(
    screen.getByRole("button", {
      name: /Salada de grão-de-bico e abobrinha rec-2/,
    }),
  );
  await change("Preparar para", "1");
  assert.match(
    screen.getByRole("row", { name: /Limão ing-6/ }).textContent,
    /≈ 0,333333un/,
  );
  assert.ok(screen.getByText(/Valor aproximado na tela/));
});
test("invalid target portions reports recovery and disables planning", async () => {
  seed();
  render(React.createElement(App));
  await change("Preparar para", "0");
  assert.match(screen.getByRole("alert").textContent, /entre 1 e 1.000/);
  assert.equal(
    screen.getByRole("button", { name: "Adicionar ao planejamento" }).disabled,
    true,
  );
});
test("two planned recipes aggregate shared IDs and keep repeated names separate", async () => {
  const book = createDemoBook();
  book.ingredients.push({ id: "other-rice", name: "Arroz", dimension: "mass" });
  book.recipes[1].items.push({
    ingredientId: "other-rice",
    quantity: "5",
    unit: "g",
  });
  seed(book);
  render(React.createElement(App));
  await addPlan();
  await user.click(
    screen.getByRole("button", {
      name: /Salada de grão-de-bico e abobrinha rec-2/,
    }),
  );
  await addPlan();
  await openPage("Planejamento e compras");
  const table = screen.getByRole("table");
  assert.match(
    within(table).getByRole("row", { name: /Abobrinha ing-2/ }).textContent,
    /700g/,
  );
  assert.ok(within(table).getByRole("row", { name: /Arroz ing-1/ }));
  assert.ok(within(table).getByRole("row", { name: /Arroz other-rice/ }));
  assert.equal(stored().plan.length, 2);
});
test("planning portions are editable and removal updates the shopping empty state", async () => {
  seed();
  render(React.createElement(App));
  await addPlan();
  await openPage("Planejamento e compras");
  await change("Porções", "2");
  await user.click(screen.getByRole("button", { name: "Aplicar" }));
  assert.equal(stored().plan[0].servings, 2);
  assert.match(
    screen.getByRole("row", { name: /Arroz ing-1/ }).textContent,
    /150g/,
  );
  await user.click(
    screen.getByRole("button", { name: /Remover Arroz com abobrinha/ }),
  );
  assert.equal(stored().plan.length, 0);
  assert.ok(screen.getByRole("heading", { name: "O que você vai preparar?" }));
});
test("recipe deletion asks about planned rows, cancellation preserves data, confirmation cascades", async () => {
  seed();
  render(React.createElement(App));
  await addPlan();
  await user.click(
    screen.getByRole("button", { name: "Excluir", exact: true }),
  );
  assert.match(
    screen.getByRole("dialog").textContent,
    /item planejado também será removido/,
  );
  await user.click(
    screen.getByRole("button", { name: "Cancelar", exact: true }),
  );
  assert.equal(stored().recipes.length, 2);
  await user.click(
    screen.getByRole("button", { name: "Excluir", exact: true }),
  );
  await user.click(
    screen.getByRole("button", { name: "Excluir receita", exact: true }),
  );
  assert.equal(stored().recipes.length, 1);
  assert.equal(stored().plan.length, 0);
  assert.equal(stored().ingredients.length, 6);
});
test("shopping CSV exports exact fractions and print calls the browser print action", async () => {
  seed();
  render(React.createElement(App));
  await addPlan();
  await openPage("Planejamento e compras");
  await user.click(screen.getByRole("button", { name: "Baixar CSV" }));
  const csv = await downloads[0].text();
  assert.match(csv, /^ingredient_id,name,numerator,denominator,unit\n/);
  assert.match(csv, /ing-1,Arroz,300,1,g/);
  let printed = false;
  window.print = () => {
    printed = true;
  };
  await user.click(screen.getByRole("button", { name: "Imprimir" }));
  assert.equal(printed, true);
});
test("backup export includes all collections in a restorable JSON", async () => {
  seed();
  render(React.createElement(App));
  await openPage("Backup");
  await user.click(screen.getByRole("button", { name: "Baixar backup JSON" }));
  assert.deepEqual(parseBook(await downloads[0].text()), stored());
});
test("invalid JSON import preserves current data and the submitted text", async () => {
  seed();
  const previous = localStorage.getItem(STORAGE_KEY);
  render(React.createElement(App));
  await openPage("Backup");
  fireEvent.change(screen.getByLabelText("Ou cole o conteúdo JSON"), {
    target: { value: "{broken" },
  });
  await user.click(screen.getByRole("button", { name: "Revisar importação" }));
  assert.equal(localStorage.getItem(STORAGE_KEY), previous);
  assert.equal(
    screen.getByLabelText("Ou cole o conteúdo JSON").value,
    "{broken",
  );
  assert.match(screen.getByRole("alert").textContent, /backup JSON válido/);
});
test("valid import requires summary and explicit replacement; cancel leaves the book untouched", async () => {
  seed();
  render(React.createElement(App));
  await openPage("Backup");
  fireEvent.change(screen.getByLabelText("Ou cole o conteúdo JSON"), {
    target: { value: serializeBook(createBook()) },
  });
  await user.click(screen.getByRole("button", { name: "Revisar importação" }));
  assert.ok(screen.getByRole("dialog"));
  assert.equal(stored().recipes.length, 2);
  await user.click(
    screen.getByRole("button", { name: "Cancelar", exact: true }),
  );
  assert.equal(stored().recipes.length, 2);
  await user.click(screen.getByRole("button", { name: "Revisar importação" }));
  await user.click(
    screen.getByRole("button", { name: "Confirmar substituição" }),
  );
  assert.deepEqual(stored(), createBook());
  assert.ok(screen.getByRole("heading", { name: /Sua próxima receita/ }));
});
test("oversized import files are rejected before reading", async () => {
  seed();
  render(React.createElement(App));
  await openPage("Backup");
  const file = new dom.window.File(["{}"], "too-large.json", {
    type: "application/json",
  });
  Object.defineProperty(file, "size", { value: 8 * 1024 * 1024 + 1 });
  fireEvent.change(screen.getByLabelText("Selecionar arquivo JSON"), {
    target: { files: [file] },
  });
  assert.match(screen.getByRole("alert").textContent, /limite de 8 MiB/);
  assert.equal(stored().recipes.length, 2);
});
test("corrupt saved data is preserved, recoverable and only removed after confirmation", async () => {
  const raw = "{invalid saved content";
  localStorage.setItem(STORAGE_KEY, raw);
  render(React.createElement(App));
  assert.equal(
    screen.getByRole("button", { name: "Nova receita", exact: true }).disabled,
    true,
  );
  await user.click(screen.getByRole("button", { name: "Baixar recuperação" }));
  assert.equal(await downloads[0].text(), raw);
  await user.click(
    screen.getByRole("button", { name: "Remover dados inválidos" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Cancelar", exact: true }),
  );
  assert.equal(localStorage.getItem(STORAGE_KEY), raw);
  await user.click(
    screen.getByRole("button", { name: "Remover dados inválidos" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Remover e começar vazio" }),
  );
  assert.equal(localStorage.getItem(STORAGE_KEY), null);
  assert.equal(
    screen.getByRole("button", { name: "Nova receita", exact: true }).disabled,
    false,
  );
});
test("quota failure keeps changes in memory and makes a restorable backup available", async () => {
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: () => null,
      setItem() {
        throw new Error("quota");
      },
    },
    configurable: true,
  });
  render(React.createElement(App));
  await user.click(screen.getByRole("button", { name: "Carregar exemplos" }));
  assert.ok(
    screen.getByRole("heading", { name: "Arroz com abobrinha", exact: true }),
  );
  assert.ok(screen.getByText("Suas alterações estão apenas nesta sessão."));
  await user.click(screen.getByRole("button", { name: "Baixar backup JSON" }));
  assert.equal(parseBook(await downloads[0].text()).recipes.length, 2);
});
test("optimistic conflict refuses a save and preserves the editor draft and external book", async () => {
  seed();
  render(React.createElement(App));
  await user.click(screen.getByRole("button", { name: "Editar", exact: true }));
  await change("Nome da receita", "Meu rascunho");
  const external = serializeBook(createBook());
  localStorage.setItem(STORAGE_KEY, external);
  await user.click(screen.getByRole("button", { name: "Salvar receita" }));
  assert.equal(screen.getByLabelText("Nome da receita").value, "Meu rascunho");
  assert.equal(localStorage.getItem(STORAGE_KEY), external);
  assert.ok(screen.getByText("Outra aba alterou os dados."));
  assert.equal(
    screen.getByRole("button", { name: "Salvar receita" }).disabled,
    true,
  );
});
test("storage events pause editing without replacing in-memory data", async () => {
  seed();
  render(React.createElement(App));
  act(() =>
    window.dispatchEvent(
      new dom.window.StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: serializeBook(createBook()),
      }),
    ),
  );
  assert.ok(
    screen.getByRole("heading", { name: "Arroz com abobrinha", exact: true }),
  );
  assert.equal(
    screen.getByRole("button", { name: "Editar", exact: true }).disabled,
    true,
  );
});
test("Web Locks makes a secondary tab read-only and offers explicit editing transfer", async () => {
  const calls = [];
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request(name, options, callback) {
        calls.push({ name, options });
        return Promise.resolve(callback(options.steal ? { name } : null));
      },
    },
  });
  render(React.createElement(App));
  await waitFor(() =>
    assert.ok(screen.getByText("Esta aba está em modo de leitura.")),
  );
  assert.equal(
    screen.getByRole("button", { name: "Nova receita", exact: true }).disabled,
    true,
  );
  await user.click(
    screen.getByRole("button", { name: "Assumir edição nesta aba" }),
  );
  await waitFor(() =>
    assert.equal(
      screen.getByRole("button", { name: "Nova receita", exact: true })
        .disabled,
      false,
    ),
  );
  assert.equal(calls[0].options.ifAvailable, true);
  assert.equal(calls[1].options.steal, true);
});

test("long names and full large fractional quantities remain available through import, scale and shopping", async () => {
  const book = {
    schemaVersion: 1,
    ingredients: [
      {
        id: "pacotes",
        name: "Pacotes de farinha integral de trigo",
        dimension: "count",
      },
      {
        id: "aveia",
        name: "Flocos de aveia finos para demonstração de um nome extenso",
        dimension: "mass",
      },
    ],
    recipes: [
      {
        id: "layout",
        title: "Cenário sintético de quantidades extensas",
        servings: 3,
        items: [
          { ingredientId: "pacotes", quantity: "1000000", unit: "un" },
          { ingredientId: "aveia", quantity: "1000000", unit: "kg" },
        ],
        steps: "Cenário sintético de layout, sem recomendação de preparo.",
      },
    ],
    plan: [{ id: "layout-1", recipeId: "layout", servings: 1000 }],
  };
  render(React.createElement(App));
  await openPage("Backup");
  fireEvent.change(screen.getByLabelText("Ou cole o conteúdo JSON"), {
    target: { value: JSON.stringify(book) },
  });
  await user.click(screen.getByRole("button", { name: "Revisar importação" }));
  await user.click(
    screen.getByRole("button", { name: "Confirmar substituição" }),
  );
  await change("Preparar para", "1000");
  function assertCompleteRows() {
    const table = screen.getByRole("table");
    for (const [ingredient, unit] of [
      [book.ingredients[0], "un"],
      [book.ingredients[1], "kg"],
    ]) {
      const row = within(table).getByRole("row", {
        name: new RegExp(ingredient.name),
      });
      assert.equal(
        within(row).getByRole("rowheader").textContent,
        ingredient.name + ingredient.id,
      );
      const cell = within(row).getByRole("cell");
      assert.ok(within(cell).getByText("≈ 333333333,333333", { exact: true }));
      assert.ok(within(cell).getByText(unit, { exact: true }));
    }
  }
  assertCompleteRows();
  assert.equal(stored().recipes[0].items[0].quantity, "1000000");
  await openPage("Planejamento e compras");
  assertCompleteRows();
  await user.click(screen.getByRole("button", { name: "Baixar CSV" }));
  const csv = await downloads[0].text();
  assert.match(
    csv,
    /pacotes,Pacotes de farinha integral de trigo,1000000000,3,un/,
  );
  assert.match(
    csv,
    /aveia,Flocos de aveia finos para demonstração de um nome extenso,1000000000000,3,g/,
  );
});
