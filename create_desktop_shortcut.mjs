// Creates Windows Desktop Shortcuts pointing to launch.bat with icon.ico
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const projectDir = 'c:\\Users\\aouin\\OneDrive\\Desktop\\iron-veil';
const iconPath = join(projectDir, 'icon.ico');
const targetBat = join(projectDir, 'launch.bat');

const candidateDesktopDirs = [
  join(homedir(), 'OneDrive', 'Desktop'),
  join(homedir(), 'Desktop'),
  'c:\\Users\\aouin\\OneDrive\\Desktop',
  'c:\\Users\\aouin\\Desktop'
];

const created = new Set();
const scriptLines = [
  '$WshShell = New-Object -ComObject WScript.Shell'
];

for (const desk of candidateDesktopDirs) {
  if (existsSync(desk) && !created.has(desk)) {
    created.add(desk);
    const lnkPath = join(desk, 'IRON VEIL - BLOOD CIRCUIT.lnk');
    scriptLines.push(`
$s = $WshShell.CreateShortcut('${lnkPath.replace(/'/g, "''")}')
$s.TargetPath = '${targetBat.replace(/'/g, "''")}'
$s.WorkingDirectory = '${projectDir.replace(/'/g, "''")}'
$s.IconLocation = '${iconPath.replace(/'/g, "''")},0'
$s.Description = 'Play IRON VEIL: BLOOD CIRCUIT'
$s.Save()
Write-Output "Created: ${lnkPath.replace(/'/g, "''")}"
`);
  }
}

const tempPs1 = join(projectDir, '_create_shortcut.ps1');
writeFileSync(tempPs1, scriptLines.join('\n'));
try {
  const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPs1}"`, { encoding: 'utf8' });
  console.log(out);
} finally {
  try { unlinkSync(tempPs1); } catch {}
}
