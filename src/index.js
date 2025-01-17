#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const { program } = require('commander');

const {
  getConfig,
  buildPrettifier,
  createParentDirectoryIfNecessary,
  logIntro,
  logItemCompletion,
  logConclusion,
  logError,
} = require('./helpers');
const {
  requireOptional,
  mkDirPromise,
  readFilePromiseRelative,
  writeFilePromise,
} = require('./utils');

// Load our package.json, so that we can pass the version onto `commander`.
const { version } = require('../package.json');

// Get the default config for this component (looks for local/global overrides,
// falls back to sensible defaults).
const config = getConfig();

// Convenience wrapper around Prettier, so that config doesn't have to be
// passed every time.
const prettify = buildPrettifier(config.prettierConfig);

program
  .version(version)
  .arguments('<componentName>')
  .option(
    '-l, --lang <language>',
    'Which language to use (default: "js")',
    /^(js|ts)$/i,
    config.lang
  )
  .option(
    '-d, --dir <pathToDirectory>',
    'Path to the "components" directory (default: "src/components")',
    config.dir
  )
  .option(
    '-s, --scss-module <scssModuleEnabled>',
    'Include SCSS module (default: "true")',
    /^(true|false)$/i,
    config.scssModule
  )
  .parse(process.argv);

const [componentName] = program.args;

const options = program.opts();

const fileExtension = options.lang === 'js' ? 'js' : 'tsx';
const indexExtension = options.lang === 'js' ? 'js' : 'ts';
const scssModuleEnabled = options.scssModule === 'true' ? true : false;

// Find the path to the selected template file.
const templatePath = `./templates/${options.lang}.js`;

// Get all of our file paths worked out, for the user's project.
const componentDir = `${options.dir}/${componentName}`;
const filePath = `${componentDir}/${componentName}.${fileExtension}`;
const indexPath = `${componentDir}/index.${indexExtension}`;
const scssModulePath = `${componentDir}/${componentName}.module.scss`;

// Our index template is super straightforward, so we'll just inline it for now.
const indexTemplate = prettify(`\
export * from './${componentName}';
export { default } from './${componentName}';
`);

logIntro({
  name: componentName,
  dir: componentDir,
  lang: options.lang,
  scssModule: options.scssModule,
});

// Check if componentName is provided
if (!componentName) {
  logError(
    `Sorry, you need to specify a name for your component like this: new-component <name>`
  );
  process.exit(0);
}

// Check to see if the parent directory exists.
// Create it if not
createParentDirectoryIfNecessary(options.dir);

// Check to see if this component has already been created
const fullPathToComponentDir = path.resolve(componentDir);
if (fs.existsSync(fullPathToComponentDir)) {
  logError(
    `Looks like this component already exists! There's already a component at ${componentDir}.\nPlease delete this directory and try again.`
  );
  process.exit(0);
}

// Start by creating the directory that our component lives in.
mkDirPromise(componentDir)
  .then(() => readFilePromiseRelative(templatePath))
  .then((template) => {
    logItemCompletion('Directory created.');
    return template;
  })
  .then((template) => {
    // Replace our placeholders with real data (so far, just the component name)
    template = template.replace(/COMPONENT_NAME/g, componentName);

    if (!scssModuleEnabled) {
      template = template.replace(`import styles from './${componentName}.module.scss';`, '');
    }

    return template;
  })
  .then((template) => {
    // Format it using prettier, to ensure style consistency, and write to file.
    writeFilePromise(filePath, prettify(template))
    return template;
  })
  .then(() =>
    logItemCompletion('Component built and saved to disk.')
  ).then(() => {
    if (scssModuleEnabled) writeFilePromise(scssModulePath)
  })
  .then(() => {
    if (scssModuleEnabled) logItemCompletion("SCSS module file built and saved to disk.");
  })
  .then(() =>
    // We also need the `index.js` file, which allows easy importing.
    writeFilePromise(indexPath, prettify(indexTemplate))
  )
  .then(() =>
    logItemCompletion("Index file built and saved to disk.")
  )
  .then(() => {
    logConclusion();
  })
  .catch((err) => {
    console.error(err);
  });
