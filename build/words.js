"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
function loadWords() {
    const possiblePaths = [
        path.join(__dirname, '../admin/words.js'),
        path.join(__dirname, '../src-admin/public/words.js'),
    ];
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
exports.default = loadWords();
//# sourceMappingURL=words.js.map