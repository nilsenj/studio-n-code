'use strict';
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { realpath } = require('node:fs/promises');
const run = promisify(execFile);

function buildBoard({ files, status = new Map(), commits = [], root = '' }) {
  const unique = [...new Set(files.filter(Boolean).map(value => value.replaceAll('\\', '/')))].sort((a, b) => a.localeCompare(b));
  const areas = new Map();
  const entries = unique.map(file => {
    const parts = file.split('/'); let prefix = '';
    for (const part of parts.slice(0, -1)) {
      prefix = prefix ? `${prefix}/${part}` : part;
      if (!areas.has(prefix)) areas.set(prefix, { id: `area:${prefix}`, kind: 'area', path: prefix, title: part, fileCount: 0 });
      areas.get(prefix).fileCount++;
    }
    return { id: `file:${file}`, kind: 'file', path: file, title: parts.at(-1), status: status.get(file) || '' };
  });
  const changes = entries.filter(entry => entry.status).map(entry => ({ ...entry, id: `change:${entry.path}`, kind: 'change' }));
  const history = commits.map(commit => ({ id: `commit:${commit.hash}`, kind: 'commit', hash: commit.hash, title: commit.subject, date: commit.date }));
  const features = commits.flatMap(commit => {
    const match = /^feat(?:\(([^)]+)\))?:\s*(.+)/i.exec(commit.subject);
    return match ? [{ id: `feature:${commit.hash}`, kind: 'feature', hash: commit.hash, title: match[2], scope: match[1] || '', date: commit.date }] : [];
  });
  return { root, files: entries, areas: [...areas.values()], changes, commits: history, features, totalFiles: entries.length };
}

function boardContext(card, source = '', maxLength = 30000) {
  const name = card.path || card.hash || card.title;
  const heading = `${card.kind}: ${name}\nTitle: ${card.title}\n`;
  const room = Math.max(0, maxLength - heading.length - 30);
  return heading + String(source).slice(0, room) + (String(source).length > room ? '\n[Context truncated]' : '');
}

async function git(root, args, maxBuffer = 16 * 1024 * 1024) {
  const { stdout } = await run('git', ['-C', root, ...args], { windowsHide: true, encoding: 'utf8', maxBuffer });
  return stdout;
}

async function loadBoard(vscode, folder) {
  if (!folder) return { ...buildBoard({ files: [] }), noWorkspace: true };
  let root = folder.uri.fsPath;
  try { root = (await git(root, ['rev-parse', '--show-toplevel'])).trim(); }
  catch {
    const uris = await vscode.workspace.findFiles('**/*', '**/{.git,node_modules,vendor,dist,out,build}/**', 20000);
    const files = uris.filter(uri => uri.fsPath.startsWith(folder.uri.fsPath + path.sep)).map(uri => path.relative(folder.uri.fsPath, uri.fsPath).replaceAll('\\', '/'));
    return { ...buildBoard({ files, root: folder.uri.fsPath }), hasGit: false };
  }
  const [rawFiles, rawStatus, rawCommits, branch] = await Promise.all([
    git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']),
    git(root, ['status', '--porcelain=v1', '--untracked-files=all', '--no-renames', '-z']),
    git(root, ['log', '--all', '--format=%H%x00%s%x00%aI', '-n', '200']).catch(() => ''),
    git(root, ['branch', '--show-current']).catch(() => ''),
  ]);
  const status = new Map();
  for (const record of rawStatus.split('\0').filter(Boolean)) status.set(record.slice(3).replaceAll('\\', '/'), record.slice(0, 2).trim() || '?');
  const commits = rawCommits.split(/\r?\n/).filter(Boolean).map(line => {
    const [hash, subject, date] = line.split('\0'); return { hash, subject, date };
  }).filter(commit => /^[a-f0-9]{40,64}$/.test(commit.hash));
  return { ...buildBoard({ files: rawFiles.split('\0').filter(Boolean), status, commits, root }), hasGit: true, branch: branch.trim() };
}

async function contextForCard(vscode, board, card) {
  if (!card) return '';
  const root = board.root;
  if (card.kind === 'file' || card.kind === 'change') {
    const file = path.resolve(root, card.path);
    if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error('File is outside the project.');
    const [realRoot, realFile] = await Promise.all([realpath(root), realpath(file)]);
    if (!realFile.startsWith(realRoot + path.sep)) throw new Error('File link points outside the project.');
    let source;
    try { source = (await vscode.workspace.openTextDocument(vscode.Uri.file(file))).getText().slice(0, 50000); }
    catch { source = '[This file is binary or cannot be opened as text.]'; }
    const diff = card.kind === 'change' && board.hasGit ? await git(root, ['diff', '--', card.path]).catch(() => '') : '';
    return boardContext(card, `${source}\n${diff}`);
  }
  if (card.kind === 'area') {
    const paths = board.files.filter(file => file.path.startsWith(card.path + '/')).slice(0, 200).map(file => file.path);
    const examples = [];
    for (const candidate of paths.slice(0, 4)) {
      try {
        const file = path.resolve(root, candidate);
        const [realRoot, realFile] = await Promise.all([realpath(root), realpath(file)]);
        if (realFile.startsWith(realRoot + path.sep)) examples.push(`\n--- ${candidate} ---\n${(await vscode.workspace.openTextDocument(vscode.Uri.file(file))).getText().slice(0, 3000)}`);
      } catch { /* A binary or deleted file still remains listed. */ }
    }
    return boardContext(card, `Files in this area (${card.fileCount} total):\n${paths.join('\n')}\nRepresentative source:${examples.join('')}`);
  }
  if ((card.kind === 'commit' || card.kind === 'feature') && /^[a-f0-9]{40,64}$/.test(card.hash)) {
    const patch = await git(root, ['show', '--format=fuller', '--stat', '--patch', '--no-renames', card.hash]).catch(() => git(root, ['show', '--format=fuller', '--stat', '--no-renames', card.hash]));
    return boardContext(card, patch);
  }
  return boardContext(card);
}

module.exports = { buildBoard, boardContext, loadBoard, contextForCard };
