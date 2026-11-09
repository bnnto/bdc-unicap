import { assert } from "vitest";

/** Forma comum dos resultados de `validateJob`, `validateResumeData` etc. */
export type Validation<T> =
  | { ok: true; normalized: T }
  | { ok: false; errors: readonly string[] };

/**
 * Exige validação bem-sucedida e devolve o valor normalizado.
 * O `assert` estreita o tipo (sem `if` no teste) e falha o teste se `ok` for false.
 */
export function expectValid<T>(result: Validation<T>): T {
  assert(result.ok, "esperava validação ok === true");
  return result.normalized;
}

/** Exige validação com falha e devolve a lista de erros. */
export function expectInvalid<T>(result: Validation<T>): readonly string[] {
  assert(!result.ok, "esperava validação ok === false");
  return result.errors;
}