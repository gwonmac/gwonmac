/** Narrowing for the Hub's DOM tests: an element of the expected class, or a thrown error that names what was found. */
export function narrow<T extends Element>(type: abstract new (...args: never[]) => T, element: Element | null | undefined): T {
  if (!(element instanceof type)) throw new Error(`Expected ${type.name}, found ${element ? element.tagName : String(element)}`);
  return element;
}
