// Metro config for the pnpm monorepo. Watches the workspace root so shared
// packages (@daybyday/schemas, @daybyday/engine) resolve, and pins module
// resolution to the two node_modules folders Metro should look in.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

// Our shared TS packages import with explicit ".js" extensions (required by
// TypeScript's NodeNext resolution), but the on-disk files are ".ts". Metro
// doesn't rewrite these, so map a failing relative ".js" import to its source.
const EMPTY_MODULE = path.resolve(projectRoot, "src/empty.js");
// Optional deps some libraries try to import but guard at runtime. Stub them so
// Metro's static bundler doesn't fail resolving a package that's never loaded.
const STUBBED_MODULES = new Set(["@opentelemetry/api"]);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (STUBBED_MODULES.has(moduleName)) {
    return { type: "sourceFile", filePath: EMPTY_MODULE };
  }
  if (/^\.\.?\//.test(moduleName) && moduleName.endsWith(".js")) {
    try {
      return context.resolveRequest(context, moduleName.replace(/\.js$/, ""), platform);
    } catch {
      // Fall through to the default resolver below for genuine .js files.
    }
  }
  const resolver = defaultResolveRequest ?? context.resolveRequest;
  return resolver(context, moduleName, platform);
};

module.exports = config;
