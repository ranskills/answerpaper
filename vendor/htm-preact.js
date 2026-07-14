import { h, render, Fragment } from "./preact.module.js";
import htm from "./htm.module.js";

export const html = htm.bind(h);
export { h, render, Fragment };
