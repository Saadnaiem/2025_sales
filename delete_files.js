
const fs = require('fs');
const path = require('path');

const files = [
    'App.tsx',
    'index.tsx',
    'types.ts'
];

const dirs = [
    'components'
];

const root = 'c:\\Saad\\New Data For Category Management\\IMF\\dashboard025\\Dashboard2025';

files.forEach(file => {
    const p = path.join(root, file);
    if (fs.existsSync(p)) {
        try {
            fs.unlinkSync(p);
            console.log(`Deleted ${file}`);
        } catch (e) {
            console.error(`Failed to delete ${file}: ${e.message}`);
        }
    } else {
        console.log(`${file} does not exist`);
    }
});

dirs.forEach(dir => {
    const p = path.join(root, dir);
    if (fs.existsSync(p)) {
        try {
            fs.rmSync(p, { recursive: true, force: true });
            console.log(`Deleted directory ${dir}`);
        } catch (e) {
            console.error(`Failed to delete directory ${dir}: ${e.message}`);
        }
    } else {
        console.log(`Directory ${dir} does not exist`);
    }
});
