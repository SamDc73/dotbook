// Tailwind 4 compiles through PostCSS. Without this, @theme passes through
// uncompiled and no utility classes are generated (silent, builds fine).
export default { plugins: { '@tailwindcss/postcss': {} } }
