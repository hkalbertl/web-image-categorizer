import { createWriteStream, mkdirSync, readFileSync } from 'fs';
import archiver from 'archiver';

// Read the package.json file
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

const output = createWriteStream(`./dist/${packageJson.name || 'output'}.zip`);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`## Browser package created: ${archive.pointer()} total bytes`);
});

archive.on('error', (err) => {
  throw err;
});

// Ensure the dist directory exists
mkdirSync('./dist', { recursive: true });

// Pipe archive data to the file
archive.pipe(output);

// Append files from the src directory
archive.directory('./build/', false);

// Finalize the archive
archive.finalize();
