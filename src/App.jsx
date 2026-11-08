import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createBook,
  validateBook,
  normalizeQuantity,
  upsertIngredient,
  removeIngredient,
  upsertRecipe,
  removeRecipe,
  upsertPlanItem,
  removePlanItem,
  scaleRecipe,
  shoppingList,
  formatAmount,
  shoppingCsv,
  serializeBook,
  parseBook,
} from "./engine.js";
import {
  browserStorage,
  readStorage,
  writeStorage,
  clearStorage,
  STORAGE_KEY,
  LOCK_NAME,
} from "./storage.js";
import { createDemoBook } from "./demo.js";

const DIMENSIONS = { mass: "Massa", volume: "Volume", count: "Unidades" };
const UNITS = { mass: ["g", "kg"], volume: ["ml", "l"], count: ["un"] };
const MESSAGES = {
  INVALID_BOOK:
    "Revise os campos, as unidades e os ingredientes. O livro não foi alterado.",
  INVALID_QUANTITY:
    "Informe uma quantidade maior que zero, até 1.000.000, com no máximo 6 casas decimais. Use ponto ou vírgula, sem separador de milhar.",
  INVALID_SERVINGS: "Informe um número inteiro de porções entre 1 e 1.000.",
  INGREDIENT_IN_USE:
    "Este ingrediente está em uma receita. Retire-o das receitas antes de excluir.",
  UNKNOWN_INGREDIENT: "O ingrediente não foi encontrado. Revise a seleção.",
  UNKNOWN_RECIPE: "A receita não foi encontrada. Revise a seleção.",
  UNKNOWN_PLAN: "O item do planejamento não foi encontrado.",
  INVALID_JSON:
    "O arquivo não é um backup JSON válido deste aplicativo. Nenhum dado foi substituído.",
  CONFLICT:
    "Outra aba alterou os dados salvos. Seu livro e seus rascunhos continuam nesta aba. Baixe um backup antes de recarregar.",
};
function errorMessage(error) {
  return (
    MESSAGES[error?.code] ||
    "Não foi possível concluir. Seu rascunho foi mantido; revise os campos e tente novamente."
  );
}
function nextId(collection, prefix) {
  const ids = new Set(collection.map((item) => item.id));
  let number = 1;
  while (ids.has(`${prefix}-${number}`)) number += 1;
  return `${prefix}-${number}`;
}
function wholeServings(value) {
  if (
    !/^[0-9]+$/.test(String(value)) ||
    Number(value) < 1 ||
    Number(value) > 1000
  ) {
    const error = new Error();
    error.code = "INVALID_SERVINGS";
    throw error;
  }
  return Number(value);
}
function download(text, name, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Icon({ name, size = 20 }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    book: (
      <>
        <path d="M5 4h13a1 1 0 0 1 1 1v15H6a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Z" />
        <path d="M3 16h16M7 8h8M7 11h5" />
      </>
    ),
    list: (
      <>
        <path d="M9 6h11M9 12h11M9 18h11M3 6h1M3 12h1M3 18h1" />
      </>
    ),
    jar: (
      <>
        <path d="M7 3h10v4H7zM6 7h12l2 4v9H4v-9l2-4Z" />
        <path d="M7 13h10M7 16h7" />
      </>
    ),
    backup: (
      <>
        <path d="M12 3v12M8 11l4 4 4-4M4 16v5h16v-5" />
        <path d="M5 7H3v6M19 7h2v6" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    print: (
      <>
        <path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7z" />
        <path d="M17 11h.01" />
      </>
    ),
    edit: (
      <>
        <path d="m14 5 5 5M4 20l5-1L20 8l-5-5L4 14v6Z" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.list}
    </svg>
  );
}
function Amount({ item }) {
  const amount = formatAmount(item.quantity, item.unit);
  return (
    <>
      <span key={`${amount.value}-${amount.unit}`} className="amount-number">
        {amount.approximate ? "≈ " : ""}
        {amount.value}
      </span>
      <span className="amount-unit">{amount.unit}</span>
    </>
  );
}
function ConfirmDialog({ confirmation, onCancel, onConfirm }) {
  const ref = useRef(null);
  const cancelRef = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    cancelRef.current?.focus();
    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby="confirmation-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="dialog-content">
        <h2 id="confirmation-title">{confirmation.title}</h2>
        <p>{confirmation.message}</p>
        {confirmation.detail}
        <div className="button-row">
          <button
            ref={cancelRef}
            className="button secondary"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className={`button ${confirmation.danger ? "danger" : "primary"}`}
            onClick={onConfirm}
          >
            {confirmation.action}
          </button>
        </div>
      </div>
    </dialog>
  );
}
function useEditorLock() {
  const supported =
    typeof navigator !== "undefined" && Boolean(navigator.locks?.request);
  const [state, setState] = useState(supported ? "pending" : "editor");
  const releaseRef = useRef(null);
  const generationRef = useRef(0);
  const claim = useCallback(
    (steal = false) => {
      if (!supported) return;
      const generation = ++generationRef.current;
      releaseRef.current?.();
      releaseRef.current = null;
      setState("pending");
      const options = steal
        ? { mode: "exclusive", steal: true }
        : { mode: "exclusive", ifAvailable: true };
      navigator.locks
        .request(LOCK_NAME, options, async (lock) => {
          if (generation !== generationRef.current) return;
          if (!lock) {
            setState("reader");
            return;
          }
          setState("editor");
          await new Promise((resolve) => {
            releaseRef.current = resolve;
          });
        })
        .catch(() => {
          if (generation === generationRef.current) setState("reader");
        });
    },
    [supported],
  );
  useEffect(() => {
    claim();
    return () => {
      generationRef.current += 1;
      releaseRef.current?.();
    };
  }, [claim]);
  return { state, supported, claim };
}

function RecipeEditor({
  draft,
  setDraft,
  ingredients,
  onSave,
  onCancel,
  disabled,
}) {
  const [error, setError] = useState("");
  const update = (key, value) => setDraft({ ...draft, [key]: value });
  const updateLine = (index, changes) =>
    update(
      "items",
      draft.items.map((line, i) =>
        i === index ? { ...line, ...changes } : line,
      ),
    );
  const addLine = () => {
    const ingredient = ingredients.find(
      (item) => !draft.items.some((line) => line.ingredientId === item.id),
    );
    update("items", [
      ...draft.items,
      {
        ingredientId: ingredient?.id || "",
        quantity: "",
        unit: ingredient ? UNITS[ingredient.dimension][0] : "g",
      },
    ]);
  };
  function submit(event) {
    event.preventDefault();
    setError("");
    try {
      if (!draft.title.trim()) throw new Error();
      const items = draft.items.map((item) => ({
        ...item,
        quantity: normalizeQuantity(item.quantity),
      }));
      if (
        new Set(items.map((item) => item.ingredientId)).size !== items.length
      ) {
        setError(
          "Cada ingrediente pode aparecer uma vez na receita. Some as quantidades ou selecione outro ID.",
        );
        return;
      }
      const recipe = {
        id: draft.id,
        title: draft.title.trim(),
        servings: wholeServings(draft.servings),
        items,
        steps: draft.steps,
      };
      onSave(recipe);
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <form className="recipe-editor" onSubmit={submit} noValidate>
      <div className="sheet-heading">
        <div>
          <h1>{draft.isNew ? "Nova receita" : "Editar receita"}</h1>
          <p className="record-id">Ficha {draft.id}</p>
        </div>
        <button className="text-button" type="button" onClick={onCancel}>
          Fechar edição
        </button>
      </div>
      <div className="editor-basics">
        <label>
          Nome da receita
          <input
            autoFocus
            name="recipe-title"
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            required
            maxLength={120}
            placeholder="Ex.: arroz com abobrinha"
          />
        </label>
        <label>
          Rendimento original <span className="field-hint">em porções</span>
          <input
            name="recipe-servings"
            type="number"
            min="1"
            max="1000"
            step="1"
            value={draft.servings}
            onChange={(event) => update("servings", event.target.value)}
            required
          />
        </label>
      </div>
      <div className="section-heading">
        <h2>Ingredientes da receita</h2>
        <span className="muted">{draft.items.length}/50 linhas</span>
      </div>
      {!ingredients.length && (
        <p className="inline-note">
          Cadastre os ingredientes na aba Ingredientes. A edição desta ficha
          fica guardada enquanto você navega.
        </p>
      )}
      <div className="recipe-lines">
        {draft.items.map((line, index) => {
          const ingredient = ingredients.find(
            (item) => item.id === line.ingredientId,
          );
          return (
            <div className="recipe-line" key={index}>
              <label className="line-ingredient">
                Ingrediente {index + 1}
                <select
                  aria-label={`Ingrediente da linha ${index + 1}`}
                  value={line.ingredientId}
                  onChange={(event) => {
                    const selected = ingredients.find(
                      (item) => item.id === event.target.value,
                    );
                    updateLine(index, {
                      ingredientId: event.target.value,
                      unit: selected ? UNITS[selected.dimension][0] : "g",
                    });
                  }}
                  required
                >
                  <option value="">Selecione um ingrediente</option>
                  {ingredients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="line-quantity">
                Quantidade
                <input
                  aria-label={`Quantidade da linha ${index + 1}`}
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(index, { quantity: event.target.value })
                  }
                  required
                  placeholder="0"
                />
              </label>
              <label className="line-unit">
                Unidade
                <select
                  aria-label={`Unidade da linha ${index + 1}`}
                  value={line.unit}
                  onChange={(event) =>
                    updateLine(index, { unit: event.target.value })
                  }
                >
                  {(ingredient ? UNITS[ingredient.dimension] : ["g"]).map(
                    (unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <button
                className="icon-button line-remove"
                type="button"
                aria-label={`Remover linha ${index + 1}`}
                disabled={draft.items.length === 1}
                onClick={() =>
                  update(
                    "items",
                    draft.items.filter((_, i) => i !== index),
                  )
                }
              >
                <Icon name="close" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        className="text-button add-line"
        type="button"
        onClick={addLine}
        disabled={disabled || draft.items.length >= 50 || !ingredients.length}
      >
        <Icon name="plus" size={16} />
        Adicionar ingrediente
      </button>
      <label className="steps-label">
        Modo de preparo
        <textarea
          rows="7"
          maxLength={10000}
          value={draft.steps}
          onChange={(event) => update("steps", event.target.value)}
          placeholder="Descreva as etapas de preparo…"
        />
      </label>
      <p className="field-hint">
        As porções recalculam ingredientes. Tempo, temperatura e técnica
        permanecem como você escreveu.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button
          className="button primary"
          disabled={disabled || !ingredients.length}
          type="submit"
        >
          Salvar receita
        </button>
        <button className="button secondary" type="button" onClick={onCancel}>
          Cancelar edição
        </button>
      </div>
    </form>
  );
}

function RecipeSheet({ recipe, book, onEdit, onDelete, onPlan, disabled }) {
  const [servings, setServings] = useState(String(recipe.servings));
  const { scaled, error } = useMemo(() => {
    try {
      return { scaled: scaleRecipe(book, recipe.id, wholeServings(servings)) };
    } catch (err) {
      return { error: errorMessage(err) };
    }
  }, [book, recipe.id, servings]);
  return (
    <article className="recipe-sheet" aria-labelledby="recipe-name">
      <div className="sheet-heading">
        <div>
          <h1 id="recipe-name">{recipe.title}</h1>
          <p className="record-id">Ficha {recipe.id}</p>
        </div>
        <div className="sheet-tools">
          <button className="text-button" disabled={disabled} onClick={onEdit}>
            <Icon name="edit" size={16} />
            Editar
          </button>
          <button
            className="text-button danger-text"
            disabled={disabled}
            onClick={onDelete}
          >
            Excluir
          </button>
        </div>
      </div>
      <div className="yield-strip">
        <div>
          <label htmlFor="target-servings">Preparar para</label>
          <div className="yield-input">
            <input
              id="target-servings"
              type="number"
              min="1"
              max="1000"
              step="1"
              value={servings}
              onChange={(event) => setServings(event.target.value)}
              aria-describedby="base-yield"
            />
            <span>porções</span>
          </div>
          <p id="base-yield">
            Receita original: {recipe.servings}{" "}
            {recipe.servings === 1 ? "porção" : "porções"}
          </p>
        </div>
        <button
          className="button primary"
          disabled={disabled || !scaled}
          onClick={() => onPlan(scaled.servings)}
        >
          <Icon name="plus" size={18} />
          Adicionar ao planejamento
        </button>
      </div>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : (
        <>
          <div className="section-heading ingredient-heading">
            <h2>Ingredientes</h2>
            <span>
              Para {scaled.servings}{" "}
              {scaled.servings === 1 ? "porção" : "porções"}
            </span>
          </div>
          <table className="amount-table" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">
                  Ingrediente
                </th>
                <th
                  scope="col"
                  role="columnheader"
                  className="quantity-heading"
                >
                  Quantidade
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {scaled.items.map((item) => (
                <tr key={item.ingredientId} role="row">
                  <th scope="row" role="rowheader">
                    <span>{item.name}</span>
                    <small>{item.ingredientId}</small>
                  </th>
                  <td className="amount-cell" role="cell">
                    <span className="amount-label" aria-hidden="true">
                      Quantidade
                    </span>
                    <span className="amount-value">
                      <Amount item={item} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {scaled.items.some(
            (item) => formatAmount(item.quantity, item.unit).approximate,
          ) && (
            <p className="precision-note">
              ≈ Valor aproximado na tela. O CSV mantém a fração exata.
            </p>
          )}
        </>
      )}
      <section className="preparation">
        <h2>Modo de preparo</h2>
        {recipe.steps ? (
          <p className="steps-text">{recipe.steps}</p>
        ) : (
          <p className="muted">Nenhuma etapa registrada.</p>
        )}
        <p className="precision-note">
          O ajuste de porções não altera tempo, temperatura nem técnica.
        </p>
      </section>
    </article>
  );
}

function IngredientCatalog({
  book,
  draft,
  setDraft,
  onSave,
  onDelete,
  disabled,
}) {
  const [error, setError] = useState("");
  function submit(event) {
    event.preventDefault();
    setError("");
    if (!draft.name.trim()) {
      setError("Informe o nome do ingrediente.");
      return;
    }
    onSave({
      id: draft.id,
      name: draft.name.trim(),
      dimension: draft.dimension,
    });
  }
  return (
    <section className="wide-page" aria-labelledby="ingredients-heading">
      <div className="page-heading">
        <div>
          <h1 id="ingredients-heading">Ingredientes</h1>
          <p>Uma identidade para cada item da sua cozinha.</p>
        </div>
        <button
          className="button primary"
          disabled={
            disabled || Boolean(draft) || book.ingredients.length >= 200
          }
          onClick={() =>
            setDraft({
              id: nextId(book.ingredients, "ing"),
              name: "",
              dimension: "mass",
              isNew: true,
            })
          }
        >
          <Icon name="plus" size={18} />
          Novo ingrediente
        </button>
      </div>
      <div className="catalog-layout">
        <div>
          <p className="table-note">
            Nomes iguais podem ter IDs diferentes. A lista de compras reúne
            apenas o mesmo ID.
          </p>
          {book.ingredients.length ? (
            <div className="table-scroll">
              <table className="catalog-table">
                <thead>
                  <tr>
                    <th scope="col">Ingrediente / ID</th>
                    <th scope="col">Medida</th>
                    <th scope="col">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {book.ingredients.map((item) => (
                    <tr key={item.id}>
                      <th scope="row">
                        {item.name}
                        <small>{item.id}</small>
                      </th>
                      <td>
                        {DIMENSIONS[item.dimension]}
                        <small>{UNITS[item.dimension].join(" ou ")}</small>
                      </td>
                      <td className="table-actions">
                        <button
                          className="text-button"
                          disabled={disabled || Boolean(draft)}
                          onClick={() => setDraft({ ...item, isNew: false })}
                          aria-label={`Editar ${item.name} (${item.id})`}
                        >
                          Editar
                        </button>
                        <button
                          className="text-button danger-text"
                          disabled={disabled}
                          onClick={() => onDelete(item)}
                          aria-label={`Excluir ${item.name} (${item.id})`}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="simple-empty">
              <Icon name="jar" size={40} />
              <h2>Seu catálogo está vazio</h2>
              <p>
                Comece pelos ingredientes que você usa. Escolha massa, volume ou
                unidades para manter as medidas compatíveis.
              </p>
            </div>
          )}
        </div>
        <aside className="catalog-aside">
          {draft ? (
            <form onSubmit={submit} className="ingredient-form" noValidate>
              <h2>{draft.isNew ? "Novo ingrediente" : "Editar ingrediente"}</h2>
              <p className="record-id">{draft.id}</p>
              <label>
                Nome do ingrediente
                <input
                  autoFocus
                  value={draft.name}
                  required
                  maxLength={80}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                  placeholder="Ex.: farinha de trigo"
                />
              </label>
              <label>
                Tipo de medida
                <select
                  value={draft.dimension}
                  onChange={(event) =>
                    setDraft({ ...draft, dimension: event.target.value })
                  }
                >
                  {Object.entries(DIMENSIONS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label} · {UNITS[value].join(" / ")}
                    </option>
                  ))}
                </select>
              </label>
              <p className="field-hint">
                Massa e volume não são convertidos entre si. Ingredientes usados
                em receitas mantêm medidas compatíveis.
              </p>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <button
                  type="submit"
                  className="button primary"
                  disabled={disabled}
                >
                  Salvar ingrediente
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setDraft(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="catalog-guide">
              <h2>Medidas com limites claros</h2>
              <dl>
                <dt>Massa</dt>
                <dd>gramas e quilogramas</dd>
                <dt>Volume</dt>
                <dd>mililitros e litros</dd>
                <dt>Unidades</dt>
                <dd>contagem do ingrediente</dd>
              </dl>
              <p>
                O aplicativo não estima densidades ou equivalências culinárias.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function PlanRow({ item, recipe, onSave, onRemove, disabled }) {
  const [servings, setServings] = useState(String(item.servings));
  const [error, setError] = useState("");
  useEffect(() => {
    setServings(String(item.servings));
  }, [item.servings]);
  function submit(event) {
    event.preventDefault();
    setError("");
    try {
      onSave({ ...item, servings: wholeServings(servings) });
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <div className="plan-row">
      <div className="plan-recipe">
        <strong>{recipe.title}</strong>
        <small>
          {recipe.id} · planejamento {item.id}
        </small>
      </div>
      <form onSubmit={submit} className="plan-portions" noValidate>
        <label htmlFor={`plan-${item.id}`}>
          Porções
          <input
            id={`plan-${item.id}`}
            type="number"
            min="1"
            max="1000"
            step="1"
            value={servings}
            onChange={(event) => setServings(event.target.value)}
            disabled={disabled}
          />
        </label>
        <button
          className="text-button"
          type="submit"
          disabled={disabled || String(item.servings) === servings}
        >
          Aplicar
        </button>
      </form>
      <button
        className="icon-button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Remover ${recipe.title} (${item.id}) do planejamento`}
      >
        <Icon name="close" />
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
function Planning({ book, onSave, onRemove, onGoRecipes, disabled }) {
  const shopping = useMemo(() => shoppingList(book), [book]);
  return (
    <section
      className="wide-page planning-page"
      aria-labelledby="planning-heading"
    >
      <div className="page-heading">
        <div>
          <h1 id="planning-heading">Planejamento e compras</h1>
          <p>
            Reúna o que vai preparar. As quantidades se somam por ingrediente.
          </p>
        </div>
        <button className="button secondary" onClick={onGoRecipes}>
          <Icon name="plus" size={18} />
          Escolher receita
        </button>
      </div>
      {!book.plan.length ? (
        <div className="planning-empty">
          <div className="empty-mark">
            <Icon name="list" size={48} />
          </div>
          <div>
            <h2>O que você vai preparar?</h2>
            <p>
              Abra uma receita, ajuste as porções e adicione ao planejamento. A
              lista de compras aparece aqui.
            </p>
            <button className="button primary" onClick={onGoRecipes}>
              Ver minhas receitas
              <Icon name="arrow" size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="planning-layout">
          <section className="plan-section">
            <div className="section-heading">
              <h2>Receitas planejadas</h2>
              <span>
                {book.plan.length} {book.plan.length === 1 ? "item" : "itens"}
              </span>
            </div>
            {book.plan.map((item) => (
              <PlanRow
                key={item.id}
                item={item}
                recipe={book.recipes.find(
                  (recipe) => recipe.id === item.recipeId,
                )}
                disabled={disabled}
                onSave={onSave}
                onRemove={() => onRemove(item.id)}
              />
            ))}
            <p className="precision-note">
              A mesma receita pode ser planejada mais de uma vez. Aplique uma
              nova quantidade de porções para atualizar as compras.
            </p>
          </section>
          <section
            className="shopping-section"
            aria-labelledby="shopping-heading"
          >
            <div className="section-heading shopping-heading">
              <h2 id="shopping-heading">Lista de compras</h2>
              <div className="button-row">
                <button
                  className="text-button"
                  onClick={() =>
                    download(
                      shoppingCsv(book),
                      "receitas-lista-de-compras.csv",
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  <Icon name="backup" size={16} />
                  Baixar CSV
                </button>
                <button className="text-button" onClick={() => window.print()}>
                  <Icon name="print" size={16} />
                  Imprimir
                </button>
              </div>
            </div>
            <p className="shopping-summary">
              {shopping.length}{" "}
              {shopping.length === 1 ? "ingrediente" : "ingredientes"} ·
              quantidades somadas
            </p>
            <table className="amount-table shopping-table" role="table">
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    Ingrediente
                  </th>
                  <th
                    scope="col"
                    role="columnheader"
                    className="quantity-heading"
                  >
                    Comprar
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {shopping.map((item) => (
                  <tr key={item.ingredientId} role="row">
                    <th scope="row" role="rowheader">
                      <span>{item.name}</span>
                      <small>{item.ingredientId}</small>
                    </th>
                    <td className="amount-cell" role="cell">
                      <span className="amount-label" aria-hidden="true">
                        Comprar
                      </span>
                      <span className="amount-value">
                        <Amount item={item} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="precision-note">
              ≈ indica aproximação na tela. O CSV exporta numerador e
              denominador exatos em g, ml ou un. Importe essas colunas como
              texto para preservar a precisão na planilha.
            </p>
          </section>
        </div>
      )}
    </section>
  );
}

function Backup({ book, onImport, disabled, onError, memory }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  async function fileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      onError(
        "O backup excede o limite de 8 MiB. Nenhum dado foi substituído.",
      );
      event.target.value = "";
      return;
    }
    setBusy(true);
    try {
      const content = await file.text();
      setText(content);
      setFileName(file.name);
    } catch {
      onError(
        "Não foi possível ler o arquivo. O conteúdo anterior foi mantido.",
      );
    } finally {
      setBusy(false);
    }
  }
  function review(event) {
    event.preventDefault();
    try {
      onImport(parseBook(text));
    } catch (err) {
      onError(errorMessage(err));
    }
  }
  return (
    <section className="wide-page backup-page" aria-labelledby="backup-heading">
      <div className="page-heading">
        <div>
          <h1 id="backup-heading">Backup dos seus dados</h1>
          <p>
            Seu livro fica neste navegador. Guarde uma cópia para levar com
            você.
          </p>
        </div>
      </div>
      <div className="backup-layout">
        <section className="export-section">
          <Icon name="backup" size={36} />
          <h2>Guardar uma cópia</h2>
          <p>
            O arquivo JSON inclui ingredientes, receitas e planejamento. Ele
            pode ser restaurado aqui ou em outro navegador.
          </p>
          <dl className="backup-counts">
            <div>
              <dt>Ingredientes</dt>
              <dd>{book.ingredients.length}</dd>
            </div>
            <div>
              <dt>Receitas</dt>
              <dd>{book.recipes.length}</dd>
            </div>
            <div>
              <dt>Planejamento</dt>
              <dd>{book.plan.length}</dd>
            </div>
          </dl>
          <button
            className="button primary"
            onClick={() =>
              download(
                serializeBook(book),
                "receitas-em-escala-backup.json",
                "application/json;charset=utf-8",
              )
            }
          >
            <Icon name="backup" size={18} />
            Baixar backup JSON
          </button>
          {memory && (
            <p className="form-error">
              Esta sessão tem alterações sem salvamento local. Baixe o backup
              antes de fechar a aba.
            </p>
          )}
          <p className="precision-note">
            Sem conta ou sincronização entre dispositivos. O aplicativo não
            envia suas receitas a um servidor.
          </p>
        </section>
        <form className="import-section" onSubmit={review}>
          <h2>Restaurar um backup</h2>
          <p>
            A importação substitui todo o livro atual. Primeiro você revisa o
            resumo; depois confirma a substituição.
          </p>
          <label className="file-label">
            Selecionar arquivo JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={fileSelected}
              disabled={disabled || busy}
            />
          </label>
          {fileName && (
            <p className="field-hint">Arquivo selecionado: {fileName}</p>
          )}
          <label>
            Ou cole o conteúdo JSON
            <textarea
              rows="9"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setFileName("");
              }}
              spellCheck="false"
              placeholder={'{\n  "schemaVersion": 1,\n  …\n}'}
            />
          </label>
          <p className="field-hint">
            Até 8 MiB. Apenas backups válidos deste aplicativo são aceitos.
          </p>
          <button
            className="button secondary"
            type="submit"
            disabled={disabled || busy || !text}
          >
            {busy ? "Lendo arquivo…" : "Revisar importação"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default function App() {
  const initialRef = useRef(null);
  if (!initialRef.current) initialRef.current = readStorage();
  const [book, setBook] = useState(initialRef.current.book);
  const expectedRaw = useRef(initialRef.current.raw);
  const [corrupt, setCorrupt] = useState(
    initialRef.current.status === "corrupt",
  );
  const [memory, setMemory] = useState(
    initialRef.current.status === "unavailable",
  );
  const [conflict, setConflict] = useState(false);
  const [page, setPage] = useState("recipes");
  const [selectedId, setSelectedId] = useState(
    initialRef.current.book.recipes[0]?.id || null,
  );
  const [recipeDraft, setRecipeDraft] = useState(null);
  const [ingredientDraft, setIngredientDraft] = useState(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const lock = useEditorLock();
  const disabled = corrupt || conflict || lock.state !== "editor";
  const selected = book.recipes.find((recipe) => recipe.id === selectedId);
  const mainRef = useRef(null);
  const noticeRef = useRef(null);
  useEffect(() => {
    const onStorage = (event) => {
      if (event.storageArea && event.storageArea !== browserStorage()) return;
      if (
        (event.key === STORAGE_KEY || event.key === null) &&
        event.newValue !== expectedRaw.current
      )
        setConflict(true);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const report = (text, tone = "error") => setNotice({ text, tone });
  function commit(next, success) {
    if (disabled) {
      report(
        "A edição está pausada. Resolva o aviso de armazenamento ou assuma a edição nesta aba.",
      );
      return false;
    }
    try {
      const raw = writeStorage(next, expectedRaw.current);
      expectedRaw.current = raw;
      setMemory(false);
    } catch (err) {
      if (err.code === "CONFLICT") {
        setConflict(true);
        report(MESSAGES.CONFLICT);
        return false;
      }
      setMemory(true);
      report(
        "A alteração está apenas nesta sessão: não foi possível salvar no navegador. Baixe um backup JSON antes de fechar a aba.",
        "warning",
      );
      setBook(next);
      return true;
    }
    setBook(next);
    if (success) report(success, "success");
    return true;
  }
  function mutate(operation, success) {
    try {
      return commit(operation(book), success);
    } catch (err) {
      report(errorMessage(err));
      return false;
    }
  }
  function navigate(next) {
    setPage(next);
    setNotice(null);
  }
  function newRecipe() {
    const ingredient = book.ingredients[0];
    setRecipeDraft({
      id: nextId(book.recipes, "rec"),
      title: "",
      servings: "4",
      items: [
        {
          ingredientId: ingredient?.id || "",
          quantity: "",
          unit: ingredient ? UNITS[ingredient.dimension][0] : "g",
        },
      ],
      steps: "",
      isNew: true,
    });
    setPage("recipes");
  }
  function saveRecipe(recipe) {
    if (
      mutate(
        (current) => upsertRecipe(current, recipe),
        "Receita salva. Você já pode ajustar as porções.",
      )
    ) {
      setSelectedId(recipe.id);
      setRecipeDraft(null);
    }
  }
  function editRecipe() {
    setRecipeDraft({
      ...selected,
      items: selected.items.map((item) => ({ ...item })),
      servings: String(selected.servings),
      isNew: false,
    });
  }
  function deleteRecipe() {
    const count = book.plan.filter(
      (item) => item.recipeId === selected.id,
    ).length;
    setConfirmation({
      title: "Excluir esta receita?",
      message: `A ficha “${selected.title}” (${selected.id}) será excluída. ${count ? `Seus ${count} ${count === 1 ? "item planejado também será removido" : "itens planejados também serão removidos"}.` : "Nenhum item do planejamento depende dela."} Os ingredientes permanecem no catálogo.`,
      action: "Excluir receita",
      danger: true,
      run: () => {
        if (
          mutate(
            (current) => removeRecipe(current, selected.id),
            "Receita excluída.",
          )
        )
          setSelectedId(
            book.recipes.find((item) => item.id !== selected.id)?.id || null,
          );
      },
    });
  }
  function loadDemo() {
    if (book.recipes.length || book.ingredients.length || book.plan.length)
      return;
    const demo = createDemoBook();
    if (
      commit(
        demo,
        "Exemplos originais carregados. Você pode editar ou excluir cada ficha.",
      )
    ) {
      setSelectedId(demo.recipes[0].id);
      setPage("recipes");
    }
  }
  function requestIngredientDelete(item) {
    if (
      book.recipes.some((recipe) =>
        recipe.items.some((line) => line.ingredientId === item.id),
      )
    ) {
      report(MESSAGES.INGREDIENT_IN_USE);
      return;
    }
    setConfirmation({
      title: "Excluir ingrediente?",
      message: `“${item.name}” (${item.id}) será removido do catálogo.`,
      action: "Excluir ingrediente",
      danger: true,
      run: () =>
        mutate(
          (current) => removeIngredient(current, item.id),
          "Ingrediente excluído.",
        ),
    });
  }
  function reloadStored() {
    const loaded = readStorage();
    if (loaded.status === "unavailable") {
      report(
        "O armazenamento está indisponível. Seu livro atual foi mantido. Baixe um backup desta sessão.",
      );
      return;
    }
    setBook(loaded.book);
    expectedRaw.current = loaded.raw;
    setCorrupt(loaded.status === "corrupt");
    setConflict(false);
    setMemory(false);
    setSelectedId(loaded.book.recipes[0]?.id || null);
    report(
      "Dados salvos recarregados. Seus rascunhos de edição foram mantidos.",
      "success",
    );
  }
  function requestReload() {
    setConfirmation({
      title: "Recarregar os dados salvos?",
      message:
        "O livro desta sessão será substituído pelo que está salvo no navegador. Baixe um backup desta sessão antes de continuar. Seus rascunhos nos formulários serão mantidos.",
      action: "Recarregar dados",
      danger: true,
      run: reloadStored,
    });
  }
  function clearCorrupt() {
    setConfirmation({
      title: "Remover os dados corrompidos?",
      message:
        "Esta ação remove o conteúdo inválido deste navegador e inicia um livro vazio. Baixe o arquivo de recuperação antes de continuar.",
      action: "Remover e começar vazio",
      danger: true,
      run: () => {
        if (lock.state !== "editor" || conflict) {
          report("Assuma a edição nesta aba antes de remover dados.");
          return;
        }
        try {
          clearStorage(expectedRaw.current);
          expectedRaw.current = null;
          setCorrupt(false);
          setBook(createBook());
          setSelectedId(null);
          setMemory(false);
          report(
            "Dados inválidos removidos. Você pode começar um novo livro.",
            "success",
          );
        } catch (err) {
          if (err.code === "CONFLICT") setConflict(true);
          report(
            err.code === "CONFLICT"
              ? MESSAGES.CONFLICT
              : "Não foi possível remover os dados. O conteúdo original foi preservado.",
          );
        }
      },
    });
  }
  const filtered = book.recipes.filter(
    (recipe) =>
      recipe.title
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")) ||
      recipe.id.includes(query),
  );
  const runConfirmation = () => {
    const action = confirmation.run;
    setConfirmation(null);
    action();
  };
  return (
    <>
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>
      <header className="app-header">
        <a
          className="brand"
          href="#receitas"
          onClick={(event) => {
            event.preventDefault();
            navigate("recipes");
          }}
        >
          <span className="brand-mark">
            <Icon name="book" size={25} />
          </span>
          <span>
            Receitas<span className="brand-second">em Escala</span>
          </span>
        </a>
        <nav aria-label="Navegação principal">
          {[
            { key: "recipes", label: "Receitas", icon: "book" },
            { key: "planning", label: "Planejamento e compras", icon: "list" },
            { key: "ingredients", label: "Ingredientes", icon: "jar" },
            { key: "backup", label: "Backup", icon: "backup" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={page === item.key ? "nav-link active" : "nav-link"}
              aria-current={page === item.key ? "page" : undefined}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              {item.key === "planning" && book.plan.length > 0 && (
                <span className="nav-count" aria-hidden="true">
                  {book.plan.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <span className="storage-state">
          <span
            className={`status-dot ${memory || corrupt || conflict ? "warning" : ""}`}
          />
          {memory
            ? "Sessão em memória"
            : corrupt
              ? "Recuperação necessária"
              : conflict
                ? "Edição pausada"
                : "Salvo neste navegador"}
        </span>
      </header>
      <div className="app-body">
        {corrupt && (
          <div className="system-banner error-banner" role="alert">
            <div>
              <strong>O conteúdo salvo não pôde ser aberto.</strong>
              <p>
                Os dados originais foram preservados. Baixe a recuperação antes
                de remover o conteúdo inválido.
              </p>
            </div>
            <div className="button-row">
              <button
                className="button secondary"
                onClick={() =>
                  download(
                    expectedRaw.current ?? "",
                    "receitas-recuperacao.txt",
                    "text/plain;charset=utf-8",
                  )
                }
              >
                Baixar recuperação
              </button>
              <button
                className="text-button danger-text"
                disabled={lock.state !== "editor" || conflict}
                onClick={clearCorrupt}
              >
                Remover dados inválidos
              </button>
            </div>
          </div>
        )}
        {conflict && (
          <div className="system-banner error-banner" role="alert">
            <div>
              <strong>Outra aba alterou os dados.</strong>
              <p>
                Esta sessão e seus rascunhos foram preservados. Faça um backup
                antes de recarregar os dados salvos.
              </p>
            </div>
            <div className="button-row">
              <button
                className="button secondary"
                onClick={() =>
                  download(
                    serializeBook(book),
                    "receitas-sessao-preservada.json",
                    "application/json;charset=utf-8",
                  )
                }
              >
                Baixar esta sessão
              </button>
              <button className="text-button" onClick={requestReload}>
                Recarregar dados salvos
              </button>
            </div>
          </div>
        )}
        {memory && !corrupt && (
          <div className="system-banner warning-banner" role="status">
            <div>
              <strong>Suas alterações estão apenas nesta sessão.</strong>
              <p>
                O armazenamento local está indisponível ou sem espaço. Baixe um
                backup antes de fechar a aba.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() =>
                download(
                  serializeBook(book),
                  "receitas-em-escala-backup.json",
                  "application/json;charset=utf-8",
                )
              }
            >
              Baixar backup JSON
            </button>
          </div>
        )}
        {lock.state === "reader" && (
          <div className="system-banner warning-banner" role="status">
            <div>
              <strong>Esta aba está em modo de leitura.</strong>
              <p>
                Outra aba está editando o livro. Você pode transferir a edição
                para cá; o livro atual será mantido.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => lock.claim(true)}
            >
              Assumir edição nesta aba
            </button>
          </div>
        )}
        {notice && (
          <div
            ref={noticeRef}
            className={`notice notice-${notice.tone}`}
            role={notice.tone === "error" ? "alert" : "status"}
          >
            <p>{notice.text}</p>
            <button
              className="icon-button"
              aria-label="Fechar aviso"
              onClick={() => setNotice(null)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        )}
        <main
          id="main-content"
          ref={mainRef}
          className={page === "recipes" ? "recipe-workspace" : "full-workspace"}
          tabIndex="-1"
        >
          {page === "recipes" && (
            <>
              <aside
                className="recipe-library"
                aria-labelledby="library-heading"
              >
                <div className="library-heading">
                  <h2 id="library-heading">Meu livro</h2>
                  <span>{book.recipes.length}/100</span>
                </div>
                <button
                  className="button primary new-recipe"
                  onClick={newRecipe}
                  disabled={
                    disabled ||
                    Boolean(recipeDraft) ||
                    book.recipes.length >= 100
                  }
                >
                  <Icon name="plus" size={18} />
                  Nova receita
                </button>
                {book.recipes.length > 0 && (
                  <label className="search-label">
                    Buscar receita
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Nome ou ID"
                    />
                  </label>
                )}
                <div className="recipe-list">
                  {filtered.map((recipe) => (
                    <button
                      key={recipe.id}
                      className={`recipe-link ${recipe.id === selectedId ? "selected" : ""}`}
                      disabled={Boolean(recipeDraft)}
                      onClick={() => setSelectedId(recipe.id)}
                      aria-current={
                        recipe.id === selectedId ? "true" : undefined
                      }
                    >
                      <span>{recipe.title}</span>
                      <small>
                        {recipe.id} · {recipe.servings}{" "}
                        {recipe.servings === 1 ? "porção" : "porções"}
                      </small>
                      <Icon name="arrow" size={17} />
                    </button>
                  ))}
                  {book.recipes.length > 0 && !filtered.length && (
                    <p className="library-empty">Nenhuma receita encontrada.</p>
                  )}
                  {!book.recipes.length && (
                    <p className="library-empty">
                      Suas receitas vão aparecer aqui, na ordem em que forem
                      criadas.
                    </p>
                  )}
                </div>
                <div className="library-bottom">
                  <span className="library-rule" />
                  <p>
                    Da sua ficha
                    <br />
                    para a sua cozinha.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => navigate("ingredients")}
                  >
                    Abrir ingredientes
                    <Icon name="arrow" size={16} />
                  </button>
                  {recipeDraft && (
                    <p className="draft-note">
                      Rascunho aberto. Salve ou feche a edição para escolher
                      outra ficha.
                    </p>
                  )}
                </div>
              </aside>
              <div className="sheet-area">
                {recipeDraft ? (
                  <RecipeEditor
                    draft={recipeDraft}
                    setDraft={setRecipeDraft}
                    ingredients={book.ingredients}
                    onSave={saveRecipe}
                    onCancel={() => setRecipeDraft(null)}
                    disabled={disabled}
                  />
                ) : selected ? (
                  <RecipeSheet
                    key={`${selected.id}-${selected.servings}`}
                    recipe={selected}
                    book={book}
                    disabled={disabled}
                    onEdit={editRecipe}
                    onDelete={deleteRecipe}
                    onPlan={(servings) =>
                      mutate(
                        (current) =>
                          upsertPlanItem(current, {
                            id: nextId(current.plan, "plano"),
                            recipeId: selected.id,
                            servings,
                          }),
                        "Receita adicionada. Abra Planejamento e compras para ver a lista.",
                      )
                    }
                  />
                ) : (
                  <div className="welcome-sheet">
                    <div className="welcome-lines">
                      <span />
                      <span />
                      <span />
                    </div>
                    <h1>
                      Sua próxima receita
                      <br />
                      começa por aqui.
                    </h1>
                    <p>
                      Guarde o seu jeito de preparar.
                      <br />
                      Ajuste as porções; leve as quantidades certas para a lista
                      de compras.
                    </p>
                    <button
                      className="button primary"
                      onClick={newRecipe}
                      disabled={disabled || book.recipes.length >= 100}
                    >
                      <Icon name="plus" size={18} />
                      Criar minha primeira receita
                    </button>
                    {!book.ingredients.length && !book.recipes.length && (
                      <div className="demo-invitation">
                        <div>
                          <h2>Quer experimentar primeiro?</h2>
                          <p>
                            Duas receitas originais de demonstração, com
                            ingredientes compartilhados. Você escolhe carregar.
                          </p>
                        </div>
                        <button
                          className="text-button"
                          disabled={disabled}
                          onClick={loadDemo}
                        >
                          Carregar exemplos
                          <Icon name="arrow" size={18} />
                        </button>
                      </div>
                    )}
                    <p className="welcome-footnote">
                      Sem conta. Seus dados ficam neste navegador.
                      <br />
                      Exporte um backup para guardar uma cópia.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
          {page === "ingredients" && (
            <IngredientCatalog
              book={book}
              draft={ingredientDraft}
              setDraft={setIngredientDraft}
              disabled={disabled}
              onSave={(item) => {
                if (
                  mutate(
                    (current) => upsertIngredient(current, item),
                    "Ingrediente salvo.",
                  )
                )
                  setIngredientDraft(null);
              }}
              onDelete={requestIngredientDelete}
            />
          )}
          {page === "planning" && (
            <Planning
              book={book}
              disabled={disabled}
              onGoRecipes={() => navigate("recipes")}
              onSave={(item) =>
                mutate(
                  (current) => upsertPlanItem(current, item),
                  "Porções atualizadas. A lista de compras foi recalculada.",
                )
              }
              onRemove={(id) =>
                mutate(
                  (current) => removePlanItem(current, id),
                  "Item removido do planejamento.",
                )
              }
            />
          )}
          {page === "backup" && (
            <Backup
              book={book}
              memory={memory}
              disabled={disabled}
              onError={(message) => report(message)}
              onImport={(incoming) =>
                setConfirmation({
                  title: "Substituir todo o livro?",
                  message:
                    "O backup foi validado. Ao confirmar, os ingredientes, receitas e o planejamento atuais serão substituídos. Esta ação não mescla os livros.",
                  action: "Confirmar substituição",
                  danger: true,
                  detail: (
                    <dl className="import-summary">
                      <div>
                        <dt>Ingredientes</dt>
                        <dd>{incoming.ingredients.length}</dd>
                      </div>
                      <div>
                        <dt>Receitas</dt>
                        <dd>{incoming.recipes.length}</dd>
                      </div>
                      <div>
                        <dt>Planejamento</dt>
                        <dd>{incoming.plan.length}</dd>
                      </div>
                    </dl>
                  ),
                  run: () => {
                    if (
                      commit(
                        validateBook(incoming),
                        "Backup restaurado. Seus rascunhos anteriores continuam disponíveis até você fechar a edição.",
                      )
                    ) {
                      setSelectedId(incoming.recipes[0]?.id || null);
                      setPage("recipes");
                    }
                  },
                })
              }
            />
          )}
        </main>
      </div>
      <footer className="app-footer">
        <span>
          Receitas em Escala <span className="footer-divider">/</span> Um livro
          que acompanha suas porções.
        </span>
        <span>
          Projeto aberto da{" "}
          <a
            href="https://lofranotecnologia.com.br/"
            target="_blank"
            rel="noreferrer"
          >
            LOFRANO TECNOLOGIA
          </a>
        </span>
      </footer>
      {confirmation && (
        <ConfirmDialog
          confirmation={confirmation}
          onCancel={() => setConfirmation(null)}
          onConfirm={runConfirmation}
        />
      )}
    </>
  );
}
