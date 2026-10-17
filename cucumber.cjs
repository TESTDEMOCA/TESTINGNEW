module.exports = {
  default: {
    requireModule: ['tsx'],
    require: ['src/support/world.ts', 'src/hooks/scenario.hooks.ts', 'src/steps/**/*.ts'],
    paths: ['features/**/*.feature'],
    format: ['summary'],
  },
};
