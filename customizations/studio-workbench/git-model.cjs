'use strict';
const path = require('node:path');
const statuses = ['M', 'A', 'D', 'R', 'C', 'M', 'D', '?', 'I', 'A', 'R', 'T'];

function selectRepository(repositories, { chosenRoot, workspaceRoot, activeRepository, platform = process.platform } = {}) {
  if (chosenRoot) {
    const chosen = repositories.find(repository => repository.rootUri.toString() === chosenRoot);
    if (chosen) return chosen;
  }
  if (workspaceRoot) {
    const normalize = value => {
      const resolved = path.resolve(value).replace(/[\\/]+$/, '');
      return platform === 'win32' ? resolved.toLowerCase() : resolved;
    };
    const root = normalize(workspaceRoot);
    const project = repositories.find(repository => normalize(repository.rootUri.fsPath) === root);
    if (project) return project;
  }
  return activeRepository || repositories[0];
}

function changesFromState(state, root) {
  const files = new Map();
  for (const [group, flag] of [[state.indexChanges || [], 'staged'], [state.workingTreeChanges || [], 'working'], [state.untrackedChanges || [], 'working'], [state.mergeChanges || [], 'conflict']]) {
    for (const change of group) {
      const file = change.uri.fsPath;
      const previous = files.get(file) || { path: file, relativePath: path.relative(root, file).replaceAll('\\', '/'), status: statuses[change.status] || '!', staged: false, working: false, conflict: false };
      previous[flag] = true;
      if (flag === 'conflict') previous.status = '!';
      files.set(file, previous);
    }
  }
  return [...files.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function validateCommitSelection(files, selected, message) {
  if (typeof message !== 'string' || !message.trim()) throw new Error('Enter a commit message.');
  if (!Array.isArray(selected) || !selected.length) throw new Error('Select files to commit.');
  const paths = [...new Set(selected)];
  if (paths.some(file => !files.some(change => change.path === file))) throw new Error('Only current changed files can be selected. Refresh and try again.');
  if (files.some(file => file.conflict)) throw new Error('Resolve merge conflicts before committing.');
  if (files.some(file => file.staged && !paths.includes(file.path))) throw new Error('There are staged files outside this selection. Include those staged files or unstage them before committing.');
  return paths;
}

function graphRows(commits) {
  const locations = new Map(commits.map((commit, row) => [commit.hash, row]));
  const lanes = [];
  const rows = commits.map((commit, row) => {
    let lane = lanes.indexOf(commit.hash);
    if (lane < 0) { lane = lanes.indexOf(null); if (lane < 0) lane = lanes.length; }
    lanes[lane] = null;
    const parents = (commit.parents || []).map((hash, index) => {
      let parentLane = lanes.indexOf(hash);
      if (parentLane < 0) {
        parentLane = index === 0 && lanes[lane] === null ? lane : lanes.indexOf(null);
        if (parentLane < 0) parentLane = lanes.length;
        lanes[parentLane] = hash;
      }
      return { hash, lane: parentLane, row: locations.get(hash) ?? commits.length };
    });
    return { ...commit, row, lane, parents };
  });
  // Resolve an edge to the lane occupied by its actual parent row.
  for (const row of rows) for (const edge of row.parents) if (rows[edge.row]) edge.lane = rows[edge.row].lane;
  return rows;
}

module.exports = { changesFromState, validateCommitSelection, graphRows, selectRepository };
