import { validateBook } from "./engine.js";

// Receitas autorais para demonstrar cálculo e planejamento; não foram testadas em cozinha.
export function createDemoBook() {
  return validateBook({
    schemaVersion: 1,
    ingredients: [
      { id: "ing-1", name: "Arroz", dimension: "mass" },
      { id: "ing-2", name: "Abobrinha", dimension: "mass" },
      { id: "ing-3", name: "Azeite", dimension: "volume" },
      { id: "ing-4", name: "Água", dimension: "volume" },
      { id: "ing-5", name: "Grão-de-bico cozido", dimension: "mass" },
      { id: "ing-6", name: "Limão", dimension: "count" },
    ],
    recipes: [
      {
        id: "rec-1",
        title: "Arroz com abobrinha",
        servings: 4,
        items: [
          { ingredientId: "ing-1", quantity: "300", unit: "g" },
          { ingredientId: "ing-2", quantity: "400", unit: "g" },
          { ingredientId: "ing-3", quantity: "30", unit: "ml" },
          { ingredientId: "ing-4", quantity: "600", unit: "ml" },
        ],
        steps:
          "Lave e corte a abobrinha em cubos.\nAqueça o azeite em uma panela e refogue a abobrinha. Acrescente o arroz e a água.\nCozinhe até o arroz ficar macio e a água ser absorvida. Sirva em seguida.\n\nExemplo original demonstrativo, sem teste culinário. Ajustar porções não ajusta o tempo nem a técnica de preparo.",
      },
      {
        id: "rec-2",
        title: "Salada de grão-de-bico e abobrinha",
        servings: 3,
        items: [
          { ingredientId: "ing-5", quantity: "450", unit: "g" },
          { ingredientId: "ing-2", quantity: "300", unit: "g" },
          { ingredientId: "ing-3", quantity: "25", unit: "ml" },
          { ingredientId: "ing-6", quantity: "1", unit: "un" },
        ],
        steps:
          "Corte a abobrinha em pedaços pequenos e refogue com parte do azeite.\nMisture a abobrinha e o grão-de-bico em uma travessa.\nTempere com o restante do azeite e o suco do limão.\n\nExemplo original demonstrativo, sem teste culinário. Ajustar porções não ajusta o tempo nem a técnica de preparo.",
      },
    ],
    plan: [],
  });
}
