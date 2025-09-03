const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ======================
// KONFIGURACJA
// ======================

// Ścieżka do katalogu głównego projektu (jeden poziom wyżej niż skrypt)
const projectRoot = path.resolve(__dirname, "..");

// TABLICA WYKLUCZEŃ - elementy, które NIE mają być uwzględniane
const excludeItems = ["node_modules", ".git", "history", "scalacz_backendu", "scalacz_frontendu", "dist", "package-lock.json", "README.md", "uploads"].map((item) => path.join(projectRoot, item));

const outputName = "Frontend";
const versionFile = path.join(process.cwd(), "project_version.json");
const fileHistoryDir = path.join(process.cwd(), "history");
const MAX_LINES_PER_FILE = 3000; // Maksymalna liczba linii na plik

if (!fs.existsSync(fileHistoryDir)) fs.mkdirSync(fileHistoryDir, { recursive: true });

// ======================
// FUNKCJE POMOCNICZE - WYKLUCZENIA
// ======================

// Funkcja sprawdzająca czy ścieżka powinna być zignorowana
function shouldExclude(itemPath, excludePaths) {
    const normalizedItem = itemPath.replace(/\\/g, "/");

    for (const excludePath of excludePaths) {
        const normalizedExclude = excludePath.replace(/\\/g, "/");

        // Dokładne dopasowanie ścieżki
        if (normalizedItem === normalizedExclude) {
            return true;
        }

        // Sprawdzenie czy element jest wewnątrz wykluczonego folderu
        if (normalizedItem.startsWith(normalizedExclude + "/")) {
            return true;
        }
    }

    return false;
}

// ======================
// FUNKCJE POMOCNICZE
// ======================

function md5Hash(bufferOrString) {
    return crypto.createHash("md5").update(bufferOrString).digest("hex");
}

function safeStat(p) {
    if (!fs.existsSync(p)) {
        console.error(`❌ Plik lub folder nie istnieje: ${p}`);
        return null;
    }
    return fs.statSync(p);
}

function buildStructureTree(p, excludePaths, indent = "") {
    const stats = safeStat(p);
    if (!stats) return "";

    // Sprawdzamy czy bieżący element powinien być wykluczony
    if (shouldExclude(p, excludePaths)) {
        return `${indent}# [EXCLUDED] ${path.relative(projectRoot, p)}\n`;
    }

    let structure = "";
    if (stats.isFile()) {
        structure += `${indent}- ${path.relative(projectRoot, p)}\n`;
    } else if (stats.isDirectory()) {
        structure += `${indent}+ ${path.relative(projectRoot, p)}\n`;
        const files = fs.readdirSync(p).sort();
        files.forEach((file) => {
            structure += buildStructureTree(path.join(p, file), excludePaths, indent + "  ");
        });
    }
    return structure;
}

function readFilesRecursively(p, excludePaths, result = []) {
    const stats = safeStat(p);
    if (!stats) return result;

    // Sprawdzamy czy bieżący element powinien być wykluczony
    if (shouldExclude(p, excludePaths)) {
        return result;
    }

    if (stats.isFile()) {
        result.push(p);
    } else if (stats.isDirectory()) {
        const files = fs.readdirSync(p).sort();
        files.forEach((file) => readFilesRecursively(path.join(p, file), excludePaths, result));
    }
    return result;
}

// POPRAWIONE: Rozróżnienie plików tekstowych po rozszerzeniu
function isTextFile(filePath) {
    const textExtensions = [".js", ".ts", ".json", ".html", ".css", ".txt", ".md", ".scss", ".csv", ".yml", ".yaml", ".xml", ".config.js"];

    const fileName = path.basename(filePath).toLowerCase();
    const ext = path.extname(filePath).toLowerCase();

    // Lista plików, które zawsze traktujemy jako tekstowe (nawet bez rozszerzenia)
    const alwaysTextFiles = [".env", ".env.test", ".gitignore", ".gitattributes", ".prettierrc", ".editorconfig", ".eslintrc", ".babelrc", ".npmrc", ".dockerignore", "dockerfile", "makefile", "readme", "license", "procfile"];

    // Sprawdzamy czy plik jest na liście zawsze tekstowych
    if (alwaysTextFiles.some((textFile) => fileName === textFile.toLowerCase() || fileName.startsWith(textFile.toLowerCase() + "."))) {
        return true;
    }

    // Pliki zaczynające się od kropki (konfiguracyjne) traktujemy jako tekstowe
    if (fileName.startsWith(".")) {
        return true;
    }

    return textExtensions.includes(ext);
}

// Funkcja do dzielenia zawartości na części
function splitContentIntoFiles(content, outputName, projectVersion) {
    const lines = content.split("\n");
    const files = [];
    let currentPart = 1;
    let currentLines = [];
    let totalLines = 0;

    for (const line of lines) {
        currentLines.push(line);
        totalLines++;

        // Jeśli osiągnięto limit linii i jesteśmy na końcu pliku (linia z ==========)
        if (totalLines >= MAX_LINES_PER_FILE && line.startsWith("==================================")) {
            const partContent = currentLines.join("\n");
            const outputFile = path.join(process.cwd(), `${outputName}_v${projectVersion}_part${currentPart}.txt`);

            fs.writeFileSync(outputFile, partContent, "utf-8");
            files.push(outputFile);

            currentPart++;
            currentLines = [];
            totalLines = 0;
        }
    }

    // Zapisz pozostałą zawartość jeśli coś zostało
    if (currentLines.length > 0) {
        const partContent = currentLines.join("\n");
        const outputFile = path.join(process.cwd(), `${outputName}_v${projectVersion}_part${currentPart}.txt`);

        fs.writeFileSync(outputFile, partContent, "utf-8");
        files.push(outputFile);
    }

    return files;
}

// ======================
// WERSJONOWANIE PLIKÓW I PROJEKTU
// ======================

const fileVersionsPath = path.join(process.cwd(), "file_versions.json");
const fileVersions = fs.existsSync(fileVersionsPath) ? JSON.parse(fs.readFileSync(fileVersionsPath, "utf-8")) : {};

const projectVersionData = fs.existsSync(versionFile) ? JSON.parse(fs.readFileSync(versionFile, "utf-8")) : { version: 0, structureHash: "" };

// ======================
// FUNKCJA SCALANIA
// ======================

function mergeFiles(excludePaths, outputName) {
    console.log("🔍 Wykluczane elementy:");
    excludePaths.forEach((path) => console.log(`  - ${path}`));

    let output = "";

    // Zaczynamy od katalogu głównego projektu
    const rootPath = projectRoot;

    // Budowanie struktury i listy plików
    const allFiles = [];
    let structureStr = "";

    structureStr += buildStructureTree(rootPath, excludePaths, "");
    allFiles.push(...readFilesRecursively(rootPath, excludePaths));

    structureStr = structureStr.trim();

    // Hash struktury + zawartości wszystkich plików
    const combinedHash = crypto.createHash("md5");
    combinedHash.update(structureStr);

    allFiles.forEach((f) => {
        const buffer = fs.readFileSync(f);
        combinedHash.update(f + md5Hash(buffer));
    });

    const currentHash = combinedHash.digest("hex");

    const previousOutputFile = path.join(process.cwd(), `${outputName}_v${projectVersionData.version}.txt`);
    const isFirstRun = projectVersionData.version === 0 || !fs.existsSync(previousOutputFile);

    if (!isFirstRun && currentHash === projectVersionData.structureHash) {
        console.log("Brak zmian w projekcie, wersja pozostaje bez zmian.");
        return;
    }

    const projectVersion = projectVersionData.version + 1;

    // Nagłówek globalny
    output += `${outputName} v.${projectVersion}\n\n`;
    output += "==================================\n";
    output += "STRUKTURA PROJEKTU\n";
    output += "==================================\n\n";
    output += structureStr + "\n";

    // Dodanie treści plików z wersjonowaniem
    allFiles.forEach((filePath) => {
        const textFile = isTextFile(filePath);
        let content = "";

        if (textFile) {
            try {
                content = fs.readFileSync(filePath, "utf-8");
                // Usuwanie BOM z plików tekstowych
                content = content.replace(/^\uFEFF/, "");
            } catch (err) {
                console.error(`Błąd odczytu pliku tekstowego ${filePath}:`, err);
                content = "<błąd odczytu>";
            }
        } else {
            content = "<plik binarny, nie wyświetlono zawartości>";
        }

        const hash = textFile ? md5Hash(Buffer.from(content, "utf-8")) : md5Hash(fs.readFileSync(filePath));

        let version = 1;
        if (fileVersions[filePath] && fileVersions[filePath].hash === hash) {
            version = fileVersions[filePath].version;
        } else if (fileVersions[filePath]) {
            version = fileVersions[filePath].version + 1;
        }

        // Zapis historii tylko jeśli zmiana
        if (!fileVersions[filePath] || fileVersions[filePath].hash !== hash) {
            const safeName = path.basename(filePath).replace(/[/\\]/g, "_");
            const histFile = path.join(fileHistoryDir, `${safeName}_v${version}.txt`);

            if (textFile) {
                fs.writeFileSync(histFile, content, "utf-8");
            } else {
                fs.writeFileSync(histFile, "<plik binarny, nie zapisano treści>", "utf-8");
            }
        }

        fileVersions[filePath] = { version, hash };

        // Używamy ścieżki względnej w nagłówku pliku
        const relativePath = path.relative(projectRoot, filePath);

        output += "\n==================================\n";
        output += `${relativePath} v.${version}\n`;
        output += "==================================\n\n";
        output += content + "\n";
    });

    fs.writeFileSync(fileVersionsPath, JSON.stringify(fileVersions, null, 2));

    // Dzielenie zawartości na części
    const outputFiles = splitContentIntoFiles(output, outputName, projectVersion);

    fs.writeFileSync(versionFile, JSON.stringify({ version: projectVersion, structureHash: currentHash }, null, 2));

    console.log(`✔ Pliki scalone do ${outputFiles.length} części:`);
    outputFiles.forEach((file) => console.log(`  - ${file}`));
    console.log(`✔ Historia plików w: ${fileHistoryDir}`);
    console.log(`✔ Przetworzono ${allFiles.length} plików źródłowych`);
}

// ======================
// URUCHOMIENIE
// ======================

mergeFiles(excludeItems, outputName);
