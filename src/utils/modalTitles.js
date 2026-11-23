// Discord caps modal titles at 45 characters. Prefixes are counted too.
const MODAL_TITLE_MAX = 45;
const ADD_PREFIX = 'Add Items — ';
const EDIT_PREFIX = 'Edit Item — ';

function truncate(str, len) {
  const value = String(str ?? '');
  return value.length > len ? value.substring(0, len - 3) + '...' : value;
}

function fitModalTitle(prefix, title) {
  const room = MODAL_TITLE_MAX - prefix.length;
  return prefix + truncate(title, room);
}

module.exports = { MODAL_TITLE_MAX, ADD_PREFIX, EDIT_PREFIX, fitModalTitle };
