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
    const state = status.get(file) || {};
    return { id: `file:${file}`, kind: 'file', path: file, title: parts.at(-1), status: typeof state === 'string' ? state : state.status || '', indexStatus: state.indexStatus || '', worktreeStatus: state.worktreeStatus || '' };
  });
  const changes = entries.filter(entry => entry.status).map(entry => ({ ...entry, id: `change:${entry.path}`, kind: 'change' }));
  const history = commits.map(commit => ({ ...commit, id: `commit:${commit.hash}`, kind: 'commit', hash: commit.hash, title: commit.subject, date: commit.commitDate || commit.date }));
  const features = commits.flatMap(commit => {
    const match = /^feat(?:\(([^)]+)\))?:\s*(.+)/i.exec(commit.subject);
    return match ? [{ ...commit, id: `feature:${commit.hash}`, kind: 'feature', hash: commit.hash, title: match[2], scope: match[1] || '', date: commit.commitDate || commit.date }] : [];
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
    git(root, ['log', '--all', '--format=%H%x1f%s%x1f%an%x1f%ae%x1f%aI%x1f%cI%x1f%P%x1e', '-n', '200']).catch(() => ''),
    git(root, ['branch', '--show-current']).catch(() => ''),
  ]);
  const status = new Map();
  for (const record of rawStatus.split('\0').filter(Boolean)) {
    const pair = record.slice(0, 2);
    status.set(record.slice(3).replaceAll('\\', '/'), { status: pair.trim() || '?', indexStatus: pair[0]?.trim() || '', worktreeStatus: pair[1]?.trim() || '' });
  }
  const commits = rawCommits.split('\x1e').filter(Boolean).map(record => {
    const [hash, subject, author, authorEmail, authorDate, commitDate, parents] = record.trim().split('\x1f');
    return { hash, subject, author, authorEmail, authorDate, commitDate, date: commitDate, parents: (parents || '').split(' ').filter(Boolean) };
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

async function detailForCard(vscode, board, card) {
  if (!card) return undefined;
  const result = { kind: card.kind, title: card.title, path: card.path || '', hash: card.hash || '', status: card.status || '', indexStatus: card.indexStatus || '', worktreeStatus: card.worktreeStatus || '', date: card.date || '', author: card.author || '', authorEmail: card.authorEmail || '' };
  if (card.kind === 'area') {
    result.members = board.files.filter(file => file.path.startsWith(`${card.path}/`)).map(file => ({ path: file.path, status: file.status || '' }));
    result.fileCount = card.fileCount; return result;
  }
  if (['commit', 'feature'].includes(card.kind) && board.hasGit && /^[a-f0-9]{40,64}$/.test(card.hash)) {
    const [metadata, names, numstats, history] = await Promise.all([
      git(board.root, ['show', '-s', '--format=%H%x1f%s%x1f%an%x1f%ae%x1f%aI%x1f%cI%x1f%P', card.hash]),
      git(board.root, ['diff-tree', '--no-commit-id', '--name-status', '-r', '--root', card.hash]),
      git(board.root, ['show', '--format=', '--no-renames', '--numstat', card.hash]),
      git(board.root, ['log', '--all', '--format=%h %s · %an · %cI', '--max-count=12', card.hash]).catch(() => ''),
    ]);
    const [hash, subject, author, authorEmail, authorDate, commitDate, parents] = metadata.trim().split('\x1f');
    result.hash = hash; result.title = card.kind === 'feature' ? card.title : subject; result.author = author; result.authorEmail = authorEmail;
    result.authorDate = authorDate; result.commitDate = commitDate; result.parents = (parents || '').split(' ').filter(Boolean);
    const stats = new Map(numstats.trim().split(/\r?\n/).filter(Boolean).map(line => { const [additions, deletions, file] = line.split('\t'); return [file, { additions: additions === '-' ? null : Number(additions), deletions: deletions === '-' ? null : Number(deletions) }]; }));
    result.changedFiles = names.trim().split(/\r?\n/).filter(Boolean).map(line => { const [status, ...parts] = line.split('\t'); const file = parts.at(-1) || ''; return { status, path: file, ...(stats.get(file) || {}) }; });
    result.stats = { files: result.changedFiles.length, additions: [...stats.values()].reduce((total, value) => total + (value.additions || 0), 0), deletions: [...stats.values()].reduce((total, value) => total + (value.deletions || 0), 0) };
    result.history = history.trim().split(/\r?\n/).filter(Boolean);
    result.patch = (await git(board.root, ['show', '--format=', '--no-ext-diff', '--no-renames', '--no-color', '--patch', '--stat', card.hash]).catch(() => '')).slice(0, 30000);
    if (card.kind === 'feature') result.sourceCommit = { hash, subject, author, authorDate, commitDate };
    return result;
  }
  if (card.kind === 'file' || card.kind === 'change') {
    result.language = path.extname(card.path).replace(/^\./, '').toUpperCase() || 'File';
    if (board.hasGit) {
      result.history = (await git(board.root, ['log', '--all', '--format=%h %s · %an · %cI', '--max-count=12', '--', card.path]).catch(() => '')).trim().split(/\r?\n/).filter(Boolean);
      if (card.kind === 'change') {
        const unstaged = await git(board.root, ['diff', '--no-ext-diff', '--no-color', '--', card.path]).catch(() => '');
        const staged = await git(board.root, ['diff', '--cached', '--no-ext-diff', '--no-color', '--', card.path]).catch(() => '');
        result.patch = (staged + (staged && unstaged ? '\n' : '') + unstaged).slice(0, 30000);
      }
    }
    return result;
  }
  return result;
}

module.exports = { buildBoard, boardContext, loadBoard, contextForCard, detailForCard };
