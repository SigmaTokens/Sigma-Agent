import { fileURLToPath } from 'url';
import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';

main();

function main() {
  if (!isAdmin()) {
    console.error('[-] Error: must run as admin!');
    process.exit(-1);
  }
  const mode = get_mode();
  if (mode === 'dev') {
    const root_dir = get_root_dir();
    setup_prettier_config(root_dir);
    setup_vscode_settings(root_dir);
    install_extensions();
  }
  install_deps();
  run_sigmatokens(mode);
}

function isAdmin() {
  try {
    if (process.platform === 'win32') {
      execSync('net session >nul 2>&1');
      return true;
    } else return process.geteuid && process.geteuid() === 0;
  } catch (e) {
    return false;
  }
}

function get_mode() {
  const mode = process.argv[2];
  return mode.includes('dev')
    ? 'dev'
    : mode.includes('prod')
      ? 'prod'
      : (console.error('[-] Please specify a mode to run the project: dev or prod'), process.exit(-1));
}

function get_root_dir() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return __dirname;
}

function is_extension_installed(extension) {
  const listCommand =
    process.platform === 'linux' ? 'sudo -u $SUDO_USER code --list-extensions' : 'code --list-extensions';
  const installedExtensions = execSync(listCommand).toString().split('\n');
  return installedExtensions.includes(extension);
}

function is_extension_updated(extension) {
  const command =
    process.platform === 'linux'
      ? 'sudo -u $SUDO_USER code --list-extensions --show-versions | grep ${extension}'
      : 'code --list-extensions --show-versions | grep ${extension}';

  return new Promise((resolve) => {
    exec(command, (error, stdout) => {
      resolve(stdout.includes('@') ? stdout.trim() : null);
    });
  });
}

function install_extension(extension) {
  try {
    console.log(Constants.TEXT_YELLOW_COLOR, `[+] Checking extension: ${extension}`, Constants.TEXT_WHITE_COLOR);

    if (is_extension_installed(extension)) {
      is_extension_updated(extension).then((updateCheck) => {
        if (updateCheck) {
          console.log(Constants.TEXT_WHITE_COLOR, `[+] ${extension} update available, upgrading...`, Constants.TEXT_WHITE_COLOR);

          if (process.platform === 'linux') {
            execSync(`sudo -u $SUDO_USER code --install-extension ${extension} --force`);
          } else {
            //(process.platform === 'win32') {
            execSync(`code --install-extension ${extension} --force`);
          }
        } else {
          console.log(Constants.TEXT_GREEN_COLOR, `[+] ${extension} is up-to-date`, Constants.TEXT_WHITE_COLOR);
        }
      });
    } else {
      console.log(`[+] Installing ${extension}...`, Constants.TEXT_WHITE_COLOR);
      if (process.platform === 'linux') {
        execSync(`sudo -u $SUDO_USER code --install-extension ${extension} --force`);
      } else {
        //(process.platform === 'win32') {
        execSync(`code --install-extension ${extension} --force`);
      }
    }
  } catch (error) {
    console.error(Constants.TEXT_RED_COLOR, `[-] Failed: ${error.message}`, Constants.TEXT_WHITE_COLOR);
    process.exit(1);
  }
}

function install_extensions() {
  const prettier = 'esbenp.prettier-vscode';
  install_extension(prettier);
  console.log(Constants.TEXT_GREEN_COLOR, '[+] Extension check complete!', Constants.TEXT_WHITE_COLOR);
}

function create_file(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(Constants.TEXT_GREEN_COLOR, `[+] Created: ${filePath}`, Constants.TEXT_WHITE_COLOR);
  } else {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(Constants.TEXT_YELLOW_COLOR, `[+] Updated: ${filePath}`, Constants.TEXT_WHITE_COLOR);
  }
}

function setup_prettier_config(rootDir) {
  const prettierConfig = `{
    "singleQuote": true,
    "trailingComma": "all",
    "tabWidth": 2,
    "semi": true,
    "printWidth": 120
  }`;

  const prettierIgnore = `node_modules
dist
build
`;

  create_file(path.join(rootDir, '.prettierrc'), prettierConfig);
  create_file(path.join(rootDir, '.prettierignore'), prettierIgnore);
}

function setup_vscode_settings(rootDir) {
  const vscodeDir = path.join(rootDir, '.vscode');
  const settingsFile = path.join(vscodeDir, 'settings.json');

  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir);
  }

  const settings = {
    'editor.defaultFormatter': 'esbenp.prettier-vscode',
    'editor.formatOnSave': true,
  };

  create_file(settingsFile, JSON.stringify(settings, null, 2));
}

function install_deps() {
  try {
    console.log(Constants.TEXT_YELLOW_COLOR, '[+] Updating deps for agent~~~', Constants.TEXT_WHITE_COLOR);
    if (process.platform !== 'linux') {
      execSync('npm install', { stdio: 'inherit' });
    } else if (process.platform === 'linux') {
      install_deps_linux();
    }

    console.log(Constants.TEXT_GREEN_COLOR, '[+] Deps update complete!', Constants.TEXT_WHITE_COLOR);
  } catch (error) {
    console.error(Constants.TEXT_RED_COLOR, '[-] Failed to update deps:', error.message, Constants.TEXT_WHITE_COLOR);
    process.exit(-1);
  }
}

function install_deps_linux() {
  const deps = ['inotify-tools'];
  deps.forEach((dep) => install_dep_linux(dep));
}

function install_dep_linux(dep_name) {
  const pkg = [
    { cmd: 'apt', install: `apt install -y ${dep_name}` },
    { cmd: 'dnf', install: `dnf install -y ${dep_name}` },
    { cmd: 'yum', install: `yum install -y ${dep_name}` },
    { cmd: 'pacman', install: `pacman -S --noconfirm ${dep_name}` },
    { cmd: 'zypper', install: `zypper install -y ${dep_name}` },
  ].find((p) => {
    try {
      execSync(`command -v ${p.cmd}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  });

  if (!pkg) {
    console.error(Constants.TEXT_RED_COLOR, '[-] No supported package manager found. Install auditd and inotify-tools manually.', Constants.TEXT_WHITE_COLOR);
    process.exit(1);
  }

  console.log(Constants.TEXT_YELLOW_COLOR, `[+] Installing deps via ${pkg.cmd}…`);
  execSync(`sudo ${pkg.install}`, { stdio: 'inherit' });
}

function run_sigmatokens(mode) {
  try {
    console.log(Constants.TEXT_GREEN_COLOR, `[+] Starting in ${mode} mode~~~`, Constants.TEXT_WHITE_COLOR);
    execSync(`npm run ${mode}`, { stdio: 'inherit' });
  } catch (error) {
    console.error('[-] Failed to start:', error.message);
    process.exit(-1);
  }
}
