import type { Step } from "./steps";

export function push(stack: Step[], next: Step): Step[] {
  if (stack[stack.length - 1] === next) return stack;
  return [...stack, next];
}

/** Backward navigation. Never pops the root, or nothing would render. */
export function pop(stack: Step[]): Step[] {
  return stack.length > 1 ? stack.slice(0, -1) : stack;
}

/** The step currently on screen: the top of the stack. */
export function current(stack: Step[]): Step {
  return stack[stack.length - 1] ?? "role";
}

/** Whether a Back button should be offered. */
export function canGoBack(stack: Step[]): boolean {
  return stack.length > 1;
}
