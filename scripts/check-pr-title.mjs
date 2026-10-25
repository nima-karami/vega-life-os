import { validatePrTitle } from "./lib/pr-title.mjs";

const title = process.env.PR_TITLE;
const result = validatePrTitle(title);

if (result.isValid) {
  console.log(`pr-title: ok — ${title}`);
} else {
  console.log(
    `::error title=PR title::${result.reason}. Use a Conventional Commit subject (type(scope): description) or Revert "…"`,
  );
  process.exitCode = 1;
}
