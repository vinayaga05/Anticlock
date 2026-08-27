#!/usr/bin/env node
/**
 * Forward host Metro (8081) into the Android emulator/device.
 * Without this, bundled media at http://localhost:8081/assets/... never loads
 * on the emulator (localhost is the guest, not the Mac).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function findAdb() {
  if (process.env.ADB) return process.env.ADB;
  const fromPath = spawnSync('which', ['adb'], { encoding: 'utf8' });
  if (fromPath.status === 0 && fromPath.stdout.trim()) {
    return fromPath.stdout.trim();
  }
  const home = os.homedir();
  const candidates = [
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb'),
    process.env.ANDROID_SDK_ROOT &&
      path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', 'adb'),
    path.join(home, 'Library/Android/sdk/platform-tools/adb'),
    path.join(home, 'Android/Sdk/platform-tools/adb'),
  ].filter(Boolean);
  return candidates.find(p => fs.existsSync(p)) || null;
}

const adb = findAdb();
if (!adb) {
  console.warn('[adb-reverse] adb not found — skip (install platform-tools or set ANDROID_HOME)');
  process.exit(0);
}

const devices = spawnSync(adb, ['devices'], { encoding: 'utf8' });
const hasDevice = (devices.stdout || '')
  .split('\n')
  .some(line => /\tdevice$/.test(line));
if (!hasDevice) {
  console.warn('[adb-reverse] no Android device/emulator attached — skip');
  process.exit(0);
}

const result = spawnSync(adb, ['reverse', 'tcp:8081', 'tcp:8081'], {
  encoding: 'utf8',
});
if (result.status !== 0) {
  console.warn(
    '[adb-reverse] failed:',
    (result.stderr || result.stdout || '').trim() || `exit ${result.status}`,
  );
  process.exit(0);
}
console.log('[adb-reverse] tcp:8081 → host Metro');
