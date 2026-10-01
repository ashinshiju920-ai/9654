import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [".cloudflare/**", ".next/**", ".open-next/**", ".vinext/**", ".wrangler/**", "dist/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
