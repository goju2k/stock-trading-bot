const { exec } = require('child_process');

const args = [];
process.argv.forEach((a) => {
  args.push(a);
});

const userArgs = args.splice(2);

const libraryName = userArgs[0];
if (!libraryName || libraryName === '') {
  throw new Error('libraryName is needed (arg0)');
}

const libraryNameSplit = libraryName.split('/');

const simpleName = libraryNameSplit[libraryNameSplit.length - 1];

const command = `nx g @nx/react:library --name=${simpleName} --unitTestRunner=jest --bundler=vite --directory=${libraryName} --component=false --importPath=@${libraryName} --minimal=true --projectNameAndRootFormat=as-provided --simpleName=true`;
console.log('command', command);
exec(command);