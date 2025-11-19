import * as fs from 'node:fs';
import * as path from 'node:path';

interface Words {
    [key: string]: {
        [lang: string]: string;
    };
}

function loadWords(): Words {
    const possiblePaths = [path.join(__dirname, '../admin/words.js'), path.join(__dirname, 'public/words.js')];

    let wordsPath = '';
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            wordsPath = p;
            break;
        }
    }

    if (!wordsPath) {
        throw new Error('Could not find words.js file');
    }

    let lines = fs
        .readFileSync(wordsPath)
        .toString('utf8')
        .split(/\r\n|\n|\r/);

    lines = lines
        .map(l => l.trim())
        .map(l => l.replace(/'/g, '"'))
        .filter(l => l);
    const start = lines.findIndex(line => line.startsWith('systemDictionary = {'));
    const end = lines.findIndex(line => line.startsWith('};'));
    lines.splice(end, lines.length - end);
    lines.splice(0, start + 1);
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, ''); // remove last comma

    lines.push('}');
    lines.unshift('{');

    return JSON.parse(lines.join('\n'));
}

export default loadWords();
